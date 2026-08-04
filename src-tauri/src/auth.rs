//! Authentication & access-control: enterprise user lookup (by local IP from
//! a config JSON) and personal account verification, plus level-based access
//! checks used before launching a game.

use crate::db::Database;
use crate::models::{AppUser, CurrentUser};
use serde::Deserialize;

/// One record in the enterprise config JSON (legacy system format). The legacy
/// files use PascalCase keys (UserId, UserAccount, UserName, UserIpAddress,
/// UserLevel), so we map snake_case Rust fields to PascalCase JSON keys.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct EnterpriseRecord {
    #[serde(default)]
    pub user_id: String,
    #[serde(default)]
    pub user_account: String,
    #[serde(default)]
    pub user_name: String,
    #[serde(default)]
    pub user_ip_address: String,
    #[serde(default)]
    pub user_level: i32,
}

/// Deserialize the enterprise config file. The legacy file is a JSON **array**.
pub fn load_enterprise_records(path: &str) -> Vec<EnterpriseRecord> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<EnterpriseRecord>>(&text).unwrap_or_default()
}

/// Returns the local IPv4 addresses of this machine (no loopback).
/// Tries the `local_ip_address` crate first; falls back to the standard
/// `UdpSocket` trick (connect to a public IP, read local addr) for reliability
/// on Windows.
pub fn local_ipv4_addresses() -> Vec<String> {
    let mut out = Vec::new();

    // 1) Try the dedicated crate.
    if let Ok(ifaces) = local_ip_address::list_afinet_netifas() {
        for (_name, ip) in ifaces {
            if let std::net::IpAddr::V4(v4) = ip {
                if !v4.is_loopback() {
                    out.push(v4.to_string());
                }
            }
        }
    }

    // 2) Fallback: connect a UDP socket to a public address and read the local
    //    socket address. No packets are actually sent (UDP is connectionless).
    if let Ok(sock) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if sock.connect("8.8.8.8:80").is_ok() {
            if let Ok(local) = sock.local_addr() {
                if let std::net::IpAddr::V4(v4) = local.ip() {
                    let s = v4.to_string();
                    if !v4.is_loopback() && !out.contains(&s) {
                        out.push(s);
                    }
                }
            }
        }
    }

    out
}

/// Public IP services tried in order. The first that returns a valid public
/// IPv4 address wins. Add more endpoints here as fallbacks.
const PUBLIC_IP_SERVICES: [&str; 6] = [
    "https://ipinfo.io/ip",
    "https://ipv4.icanhazip.com",
    "https://v4.ident.me",
    "https://api64.ipify.org?format=json",
    "https://api.ipify.org",
    "https://ip.seeip.org",
];

/// Parse a response body into a valid non-loopback **IPv4** address.
/// Handles both plain-text bodies (`1.2.3.4`) and JSON bodies
/// (`{"ip":"1.2.3.4"}` / `{"ip":"::1"}`). IPv6 addresses are rejected.
fn parse_ipv4(s: &str) -> Option<String> {
    let t = s.trim();
    if t.is_empty() {
        return None;
    }
    // If the response is JSON like {"ip":"..."}, extract the ip field.
    let candidate = if t.starts_with('{') {
        let v: serde_json::Value = serde_json::from_str(t).ok()?;
        v.get("ip").and_then(|x| x.as_str())?.trim().to_string()
    } else {
        t.to_string()
    };
    let ip: std::net::Ipv4Addr = candidate.parse().ok()?;
    if ip.is_loopback() {
        return None;
    }
    Some(ip.to_string())
}

/// Fetch the public (external) IPv4 address of this machine by trying the
/// services in `PUBLIC_IP_SERVICES` in order. Returns `None` if offline or all
/// services fail / return invalid data.
pub fn public_ipv4_address() -> Option<String> {
    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(5))
        .build();
    for service in PUBLIC_IP_SERVICES {
        match agent.get(service).call() {
            Ok(resp) => {
                if let Ok(body) = resp.into_string() {
                    if let Some(ip) = parse_ipv4(&body) {
                        return Some(ip);
                    }
                }
            }
            Err(_) => continue, // try next service
        }
    }
    None
}

/// Look up the cafe name (UserName) for a public IP from the enterprise config.
/// Returns `Some(name)` if matched, else `None`.
pub fn cafe_name_for_public_ip(records: &[EnterpriseRecord], public_ip: &str) -> Option<String> {
    records
        .iter()
        .find(|r| r.user_ip_address == public_ip)
        .map(|r| {
            if !r.user_name.is_empty() {
                r.user_name.clone()
            } else {
                r.user_ip_address.clone()
            }
        })
}

/// Resolve the current user from the enterprise config by matching any local
/// IP. Returns `Some` if a record matched, otherwise `None` (not enterprise).
pub fn resolve_enterprise_user(
    records: &[EnterpriseRecord],
    local_ips: &[String],
) -> Option<CurrentUser> {
    for rec in records {
        if local_ips.iter().any(|ip| *ip == rec.user_ip_address) {
            let level = rec.user_level.clamp(1, 3);
            let account = if !rec.user_account.is_empty() {
                rec.user_account.clone()
            } else {
                rec.user_ip_address.clone()
            };
            let name = if !rec.user_name.is_empty() {
                rec.user_name.clone()
            } else {
                account.clone()
            };
            return Some(CurrentUser {
                kind: "enterprise".into(),
                name,
                account,
                level,
            });
        }
    }
    None
}

/// Verify a personal account login. Returns the resolved user if the password
/// matches, otherwise `None`.
pub fn verify_personal_login(
    db: &Database,
    account: &str,
    password: &str,
) -> crate::Result<Option<CurrentUser>> {
    let Some(user) = db.get_user_by_account(account)? else {
        return Ok(None);
    };
    if hash_password(password) != user.password_hash {
        return Ok(None);
    }
    Ok(Some(CurrentUser {
        kind: "personal".into(),
        name: user.name,
        account: user.account,
        level: user.level,
    }))
}

/// SHA-256 based password hash with a fixed salt.
pub fn hash_password(password: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(b"playnite-salt::");
    hasher.update(password.as_bytes());
    hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect()
}

/// Strip sensitive fields before exposing a user to the admin UI.
pub fn public_user(u: &AppUser) -> serde_json::Value {
    serde_json::json!({
        "id": u.id,
        "account": u.account,
        "name": u.name,
        "level": u.level,
        "createdAt": u.created_at,
    })
}

/// Whether a user of `user_level` may play a game whose level is `game_level`.
/// Rule: user level N can play games with game_level <= N.
pub fn can_play(user_level: i32, game_level: i32) -> bool {
    user_level >= game_level
}
