// 启动时的公告弹窗。
// 交互全部走 document 捕获阶段的原生 mousedown 监听（已被验证能可靠触发），
// 不用 React 的 onClick——因为嵌在 WebView2 页面里的层，React 合成事件偶尔失效。
//
// 行为说明：
//  - 默认 5 秒后自动关闭（底部显示"Ns 后自动关闭"）。
//  - "停止计时器"按钮：点一下停止倒计时（显示"已停止 ✓"），不再自动关。
//  - 底部居中的"关闭"按钮：点一下立即关闭。
//  - 点弹窗里其它任何地方：也停止倒计时。
//  - 按 Esc 关闭。
//  - 公告打开期间暂停主界面封面加载，关闭后恢复。

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import announcementHtml from "../../announcements/announcement.html?raw";
import { suspendImageLoading, resumeImageLoading } from "../utils/assets";

const TOTAL_MS = 5000;

interface Props {
  onClose: () => void;
}

export default function AnnouncementModal({ onClose }: Props) {
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(Math.ceil(TOTAL_MS / 1000));

  const timerRef = useRef<number | null>(null);
  const pausedRef = useRef(false);

  // 用 ref 保存最新函数，方便 document 监听只绑一次。
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // 公告打开期间暂停主界面封面加载；组件卸载后恢复。
  useEffect(() => {
    suspendImageLoading();
    return () => resumeImageLoading();
  }, []);

  // 启动倒计时，每秒减 1。
  useEffect(() => {
    timerRef.current = window.setInterval(() => {
      setRemaining((r) => r - 1);
    }, 1000);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, []);

  // 倒计时到 0 就自动关闭（没被暂停时才关）。
  useEffect(() => {
    if (remaining <= 0 && !pausedRef.current) onClose();
  }, [remaining, onClose]);

  // 永久停掉倒计时。
  const stopCountdown = () => {
    pausedRef.current = true;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPaused(true);
  };

  // 所有交互统一在这里：document 捕获阶段监听 mousedown。
  // 用 data-action 属性精确区分按钮：close=关闭，其余一律停止倒计时。
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const btn = target?.closest?.("[data-action]") as HTMLElement | null;
      if (btn && btn.dataset.action === "close") {
        // 点"关闭"按钮 → 立即关闭
        onCloseRef.current();
        return;
      }
      // 点其它任何地方（包括"停止计时器"）→ 停止倒计时
      stopCountdown();
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, []);

  // 按 Esc 关闭。
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const html =
    announcementHtml && announcementHtml.trim().length > 0
      ? announcementHtml
      : "<div class=\"announcement-hero\"><h1>Welcome</h1><p>Your game library, reimagined.</p></div>";

  const overlay = (
    <div className="announcement-overlay">
      <div className="announcement-card">
        <div className="announcement-body">
          <div className="announcement-scroll">
            <div
              className="announcement-content"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>

        {/* 底部居中：倒计时状态 + "关闭"按钮 */}
        <div className="announcement-footer">
          <span className="announcement-countdown">
            {paused ? "已停止自动关闭" : `${remaining}s 后自动关闭`}
          </span>
          <button
            className="announcement-close-btn"
            type="button"
            data-action="close"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );

  // 挂到 <body> 下面，脱离主界面 DOM。
  return createPortal(overlay, document.body);
}
