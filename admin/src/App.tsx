import { useEffect, useMemo, useState } from "react";
import { call, type Game, type GameAction, type PublicUser, type AppSettings, type EnterprisePreview } from "./lib";

type Tab = "games" | "users" | "config";

export default function AdminApp() {
  const [tab, setTab] = useState<Tab>("games");
  const [games, setGames] = useState<Game[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Game editors
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [gameForm, setGameForm] = useState({
    name: "",
    gameLevel: 1,
    actionType: "File",
    actionPath: "",
    workingDir: "",
    arguments: "",
  });
  // User editor
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);
  const [userForm, setUserForm] = useState({ id: "", account: "", name: "", level: 1, password: "" });

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  const reload = async () => {
    setLoading(true);
    try {
      const [g, u, s] = await Promise.all([
        call<Game[]>("get_games"),
        call<PublicUser[]>("admin_list_users"),
        call<AppSettings>("admin_get_settings"),
      ]);
      setGames(g);
      setUsers(u);
      setSettings(s);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  // ---------------- Game actions ----------------
  const saveGameLevel = async (id: string, level: number) => {
    await call("admin_set_game_level", { gameId: id, level });
    setGames((gs) => gs.map((g) => (g.id === id ? { ...g, gameLevel: level } : g)));
    showToast(`已设置等级 ${level}`);
  };

  const openNewGame = () => {
    setEditingGame({ id: "", name: "", gameLevel: 1, developer: [], genre: [], platform: [], category: [] });
    setGameForm({
      name: "",
      gameLevel: 1,
      actionType: "File",
      actionPath: "",
      workingDir: "",
      arguments: "",
    });
  };
  const openEditGame = (g: Game) => {
    // Pick the play action (first is-play-action, else first File action) to prefill the form.
    const play =
      (g.actions || []).find((a) => a.isPlayAction) ||
      (g.actions || []).find((a) => a.type === "File");
    setEditingGame(g);
    setGameForm({
      name: g.name,
      gameLevel: g.gameLevel,
      actionType: play?.type || "File",
      actionPath: play?.path || "",
      workingDir: play?.workingDir || "",
      arguments: play?.arguments || "",
    });
  };

  // Build the launch action list from the form: keep existing non-play actions
  // and replace the play action with the current form values.
  const buildActions = (existing: GameAction[] = []): GameAction[] => {
    const rest = existing.filter((a) => !a.isPlayAction);
    const id = existing.find((a) => a.isPlayAction)?.id || crypto.randomUUID();
    const action: GameAction = {
      id,
      name: gameForm.actionType === "URL" ? "打开链接" : "启动游戏",
      type: gameForm.actionType,
      path: gameForm.actionPath || null,
      workingDir: gameForm.workingDir || null,
      arguments: gameForm.arguments || null,
      isPlayAction: true,
      trackGame: gameForm.actionType === "File",
    };
    return [...rest, action];
  };

  const saveGame = async () => {
    if (!gameForm.name.trim()) {
      showToast("请输入游戏名称");
      return;
    }
    if (editingGame && editingGame.id) {
      const updated = {
        ...editingGame,
        name: gameForm.name,
        gameLevel: gameForm.gameLevel,
        actions: buildActions(editingGame.actions),
      };
      await call("save_game", { game: updated });
      showToast("已保存游戏");
    } else {
      const created: Game = {
        id: crypto.randomUUID(),
        name: gameForm.name,
        gameLevel: gameForm.gameLevel,
        developer: [],
        genre: [],
        platform: [],
        category: [],
        actions: buildActions([]),
        modified: new Date().toISOString(),
      };
      await call("save_game", { game: created });
      showToast("已新增游戏");
    }
    setEditingGame(null);
    await reload();
  };

  const deleteGame = async (id: string, name: string) => {
    if (!confirm(`确定删除《${name}》？`)) return;
    await call("delete_game", { id });
    setGames((gs) => gs.filter((g) => g.id !== id));
    showToast("已删除游戏");
  };

  // ---------------- User actions ----------------
  const openNewUser = () => {
    setEditingUser({ id: "", account: "", name: "", level: 1, createdAt: "" });
    setUserForm({ id: "", account: "", name: "", level: 1, password: "" });
  };
  const openEditUser = (u: PublicUser) => {
    setEditingUser(u);
    setUserForm({ id: u.id, account: u.account, name: u.name, level: u.level, password: "" });
  };
  const saveUser = async () => {
    if (!userForm.account.trim()) {
      showToast("请输入账号");
      return;
    }
    await call("admin_save_user", {
      id: userForm.id,
      account: userForm.account.trim(),
      name: userForm.name,
      level: userForm.level,
      password: userForm.password,
    });
    setEditingUser(null);
    showToast("已保存用户");
    await reload();
  };
  const deleteUser = async (id: string, account: string) => {
    if (!confirm(`确定删除用户 ${account}？`)) return;
    await call("admin_delete_user", { id });
    setUsers((us) => us.filter((u) => u.id !== id));
    showToast("已删除用户");
  };

  // ---------------- Config ----------------
  const saveConfigPath = async (path: string) => {
    const s = await call<AppSettings>("admin_set_enterprise_config", { configPath: path });
    setSettings(s);
    showToast("已保存配置文件路径");
  };

  const previewEnterprise = async () => {
    if (!settings) return;
    const p = await call<EnterprisePreview>("admin_preview_enterprise", { configPath: settings.enterpriseConfigPath });
    alert(
      `路径: ${p.path}\n存在: ${p.exists}\n记录数: ${p.records}\n本机IP: ${p.matchedIp || "未知"}\n匹配用户: ${p.matchedName || "无"}${p.matchedName ? ` (等级 ${p.matchedLevel})` : ""}`
    );
  };

  // Filter games for search
  const [query, setQuery] = useState("");
  const filteredGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => g.name.toLowerCase().includes(q));
  }, [games, query]);

  if (loading) {
    return <div className="admin-loading">Loading…</div>;
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <h1>YunGame Admin</h1>
        <nav className="admin-tabs">
          <button className={tab === "games" ? "active" : ""} onClick={() => setTab("games")}>
            游戏管理
          </button>
          <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
            用户管理
          </button>
          <button className={tab === "config" ? "active" : ""} onClick={() => setTab("config")}>
            企业配置
          </button>
        </nav>
        <div className="admin-tools">
          <button onClick={() => void reload()}>刷新</button>
        </div>
      </header>

      {error && <div className="admin-error">{error}</div>}
      {toast && <div className="admin-toast">{toast}</div>}

      <main className="admin-body">
        {tab === "games" && (
          <section className="admin-panel">
            <div className="panel-head">
              <input
                className="admin-search"
                placeholder="搜索游戏…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={openNewGame}>+ 新增游戏</button>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>等级</th>
                  <th>启动路径</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredGames.map((g) => {
                  const play = (g.actions || []).find((a) => a.isPlayAction) || (g.actions || [])[0];
                  return (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td>
                      <select
                        value={g.gameLevel}
                        onChange={(e) => void saveGameLevel(g.id, Number(e.target.value))}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </td>
                    <td className="action-path">
                      {play ? (
                        <>
                          <span className="tag">{play.type === "URL" ? "URL" : "File"}</span>
                          <code title={play.path || ""}>{play.path || "—"}</code>
                        </>
                      ) : (
                        <span className="muted">自动扫描</span>
                      )}
                    </td>
                    <td className="row-actions">
                      <button onClick={() => openEditGame(g)}>编辑</button>
                      <button className="danger" onClick={() => void deleteGame(g.id, g.name)}>
                        删除
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {tab === "users" && (
          <section className="admin-panel">
            <div className="panel-head">
              <span>个人用户（企业用户由 IP 配置文件判定）</span>
              <button onClick={openNewUser}>+ 新增用户</button>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>账号</th>
                  <th>名称</th>
                  <th>等级</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.account}</td>
                    <td>{u.name}</td>
                    <td>{u.level}</td>
                    <td className="row-actions">
                      <button onClick={() => openEditUser(u)}>编辑</button>
                      <button className="danger" onClick={() => void deleteUser(u.id, u.account)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === "config" && settings && (
          <section className="admin-panel">
            <div className="config-block">
              <h3>企业用户配置文件</h3>
              <p className="hint">
                企业用户根据本机 IP 匹配配置文件中的 UserIpAddress 来确定用户等级。
              </p>
              <div className="config-row">
                <input
                  value={settings.enterpriseConfigPath}
                  onChange={(e) => setSettings({ ...settings, enterpriseConfigPath: e.target.value })}
                  placeholder="D:/1.json"
                />
                <button onClick={() => void saveConfigPath(settings.enterpriseConfigPath)}>
                  保存路径
                </button>
                <button onClick={() => void previewEnterprise()}>预览匹配</button>
              </div>
            </div>

            <div className="config-block">
              <h3>等级权限规则</h3>
              <p className="hint">
                用户等级 N 可玩所有游戏等级 ≤ N 的游戏。等级 1 只能玩等级 1 游戏，等级 3 可玩全部。
                无权限游戏在客户端显示，但点"开始游戏"会提示等级不足。
              </p>
            </div>
          </section>
        )}
      </main>

      {/* ---------------- Modals ---------------- */}
      {editingGame && (
        <div className="admin-modal-mask" onClick={() => setEditingGame(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingGame.id ? "编辑游戏" : "新增游戏"}</h3>
            <label>
              游戏名称
              <input value={gameForm.name} onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })} />
            </label>
            <label>
              访问等级
              <select
                value={gameForm.gameLevel}
                onChange={(e) => setGameForm({ ...gameForm, gameLevel: Number(e.target.value) })}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>

            <div className="action-block">
              <h4>启动配置（Play Action）</h4>
              <p className="hint">
                优先使用相对路径：游戏通常与 YunGame.exe 同盘，可用 <code>.</code>
                或 <code>..</code> 从 exe 目录定位。例如 <code>.\Game\Game.exe</code>、
                <code>..\Games\Game\Game.exe</code>。留空则客户端尝试自动扫描安装目录。
              </p>
              <label>
                类型
                <select
                  value={gameForm.actionType}
                  onChange={(e) => setGameForm({ ...gameForm, actionType: e.target.value })}
                >
                  <option value="File">File（启动程序）</option>
                  <option value="URL">URL（打开链接）</option>
                </select>
              </label>
              <label>
                路径（可相对）
                <input
                  value={gameForm.actionPath}
                  onChange={(e) => setGameForm({ ...gameForm, actionPath: e.target.value })}
                  placeholder='如 .\Game\Game.exe 或 ..\Game\Game.exe'
                />
              </label>
              <label>
                工作目录（可选，默认取程序所在目录）
                <input
                  value={gameForm.workingDir}
                  onChange={(e) => setGameForm({ ...gameForm, workingDir: e.target.value })}
                  placeholder="留空则使用路径所在目录"
                />
              </label>
              <label>
                启动参数（可选）
                <input
                  value={gameForm.arguments}
                  onChange={(e) => setGameForm({ ...gameForm, arguments: e.target.value })}
                  placeholder="如 --windowed 等"
                />
              </label>
            </div>

            <div className="modal-actions">
              <button onClick={() => setEditingGame(null)}>取消</button>
              <button className="primary" onClick={() => void saveGame()}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="admin-modal-mask" onClick={() => setEditingUser(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingUser.id ? "编辑用户" : "新增用户"}</h3>
            <label>
              账号
              <input value={userForm.account} onChange={(e) => setUserForm({ ...userForm, account: e.target.value })} />
            </label>
            <label>
              名称
              <input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
            </label>
            <label>
              等级
              <select value={userForm.level} onChange={(e) => setUserForm({ ...userForm, level: Number(e.target.value) })}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label>
              密码{editingUser.id ? "（留空则不修改）" : ""}
              <input
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button onClick={() => setEditingUser(null)}>取消</button>
              <button className="primary" onClick={() => void saveUser()}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
