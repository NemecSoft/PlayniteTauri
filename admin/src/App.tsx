import { useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { call, type Game, type GameAction, type GameLibrary, type PublicUser, type AppSettings } from "./lib";

// Modal backdrop. Clicking the mask does NOT close the modal — the dialog can
// only be closed via an explicit button (取消 / 保存). This prevents accidental
// data loss from mis-clicks, and also ignores drags that start inside the
// dialog (text selection spilling onto the backdrop).
function ModalMask({ children }: { children: React.ReactNode }) {
  return <div className="admin-modal-mask">{children}</div>;
}

type Tab = "games" | "users" | "libraries";

// Editor sub-tabs for a game.
type EditTab = "general" | "actions" | "scripts";

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
  const [editTab, setEditTab] = useState<EditTab>("general");
  const [gameForm, setGameForm] = useState({
    name: "",
    gameLevel: 1,
    developer: [] as string[],
    genre: [] as string[],
    platform: [] as string[],
    category: [] as string[],
    tags: [] as string[],
    gameLibrary: "",
    version: "",
    publisher: [] as string[],
    series: [] as string[],
    releaseDate: "",
    description: "",
    guide: "",
    notes: "",
    favorite: false,
    hidden: false,
    actions: [] as GameAction[],
    preLaunchScript: "",
    preLaunchEnabled: false,
    postLaunchScript: "",
    postLaunchEnabled: false,
    postExitScript: "",
    postExitEnabled: false,
  });
  // Game libraries: [{ name, path }] — name is user-editable ("库1" etc.),
  // path is the root directory. Referenced via `{name}` placeholders.
  const [gameLibraries, setGameLibraries] = useState<GameLibrary[]>([]);
  // Unsaved-changes guards: snapshot the form on open, compare on close-request.
  const gameFormInitRef = useRef("");
  const libraryFormInitRef = useRef("");
  const userFormInitRef = useRef("");
  const isGameDirty = () => JSON.stringify(gameForm) !== gameFormInitRef.current;
  const isLibraryDirty = () => JSON.stringify(libraryForm) !== libraryFormInitRef.current;
  const isUserDirty = () => JSON.stringify(userForm) !== userFormInitRef.current;

  // Close-request handlers: prompt before discarding unsaved edits.
  const requestCloseGame = () => {
    if (isGameDirty()) {
      askConfirm("有未保存的修改，确定要放弃并关闭吗？", () => setEditingGame(null));
    } else {
      setEditingGame(null);
    }
  };
  const requestCloseLibrary = () => {
    if (isLibraryDirty()) {
      askConfirm("有未保存的修改，确定要放弃并关闭吗？", () => setEditingLibrary(null));
    } else {
      setEditingLibrary(null);
    }
  };
  const requestCloseUser = () => {
    if (isUserDirty()) {
      askConfirm("有未保存的修改，确定要放弃并关闭吗？", () => setEditingUser(null));
    } else {
      setEditingUser(null);
    }
  };

  // Game-library editor
  const [editingLibrary, setEditingLibrary] = useState<GameLibrary | null>(null);
  const [libraryForm, setLibraryForm] = useState({ id: "", name: "", path: "" });
  // User editor
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);
  const [userForm, setUserForm] = useState({ id: "", account: "", name: "", level: 1, kind: "personal", password: "" });

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  // Custom confirmation dialog (window.confirm is unreliable in WebView2).
  const [confirmState, setConfirmState] = useState<{ message: string; onOk: () => void } | null>(null);
  const askConfirm = (message: string, onOk: () => void) => setConfirmState({ message, onOk });

  // Undo bar after a deletion, so destructive actions can be reverted.
  const [undoState, setUndoState] = useState<{ message: string; onUndo: () => Promise<void> } | null>(null);

  // Per-action validation results, keyed by action id (for real FS checks).
  const [actionValid, setActionValid] = useState<Record<string, { valid: boolean; resolved: string; reason: string }>>({});

  // Track which actions had their `workingDir` customized by the user. The
  // default working directory is derived from `path` (exe.parent) and is
  // auto-synced while the user hasn't touched it.
  const customWorkingDirRef = useRef<Record<string, boolean>>({});

  // 脚本"测试"的每行结果，key 区分三段脚本（pre/postLaunch/postExit）。
  const [scriptTest, setScriptTest] = useState<Record<string, { line: string; ok: boolean; error?: string }[]>>({});
  const runTestScript = async (kind: "pre" | "postLaunch" | "postExit") => {
    const script = kind === "pre" ? gameForm.preLaunchScript : kind === "postLaunch" ? gameForm.postLaunchScript : gameForm.postExitScript;
    if (!script || !script.trim()) {
      showToast("脚本为空，无可测试");
      return;
    }
    try {
      const r = await call<{ line: string; ok: boolean; error?: string }[]>("test_script", {
        script,
        gameId: editingGame?.id || null,
      });
      setScriptTest((prev) => ({ ...prev, [kind]: r }));
    } catch (e) {
      showToast(`测试失败: ${String(e)}`);
    }
  };

  /** Derive the default working directory from a launch path.
   *
   * The working directory is always the **game's own directory**:
   *   - if `path` ends with an executable extension (`.exe/.bat/.cmd/.lnk/.com`),
   *     it is a launcher file → workingDir = that file's parent directory;
   *   - otherwise `path` is already a directory → workingDir = the path itself.
   *
   * Examples:
   *   `{Gamelibrary2}\X\Sephiria\Sephiria.exe`  → `{Gamelibrary2}\X\Sephiria`
   *   `{Gamelibrary2}\X\Sephiria`                → `{Gamelibrary2}\X\Sephiria`
   *   `{Gamelibrary2}\X\Sephiria\bin\game.exe`   → `{Gamelibrary2}\X\Sephiria\bin`
   */
  const deriveWorkingDir = (path: string): string => {
    if (!path) return "";
    const EXE = /\.(exe|bat|cmd|lnk|com)$/i;
    if (EXE.test(path)) {
      const lastSlash = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
      if (lastSlash <= 0) return "";
      return path.substring(0, lastSlash);
    }
    // Path is a directory → working directory is the path itself.
    return path;
  };

  // Debounce + call the real filesystem validation for a launch action.
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const validateAction = (actionId: string, path: string, type: string) => {
    const id = debounceRef.current[actionId];
    if (id) clearTimeout(id);
    if (!path.trim()) {
      setActionValid((v) => ({ ...v, [actionId]: { valid: true, resolved: "", reason: "" } }));
      return;
    }
    debounceRef.current[actionId] = setTimeout(async () => {
      try {
        const r = await call<{ valid: boolean; resolved: string; reason: string }>(
          "admin_validate_action",
          { path, type }
        );
        setActionValid((v) => ({ ...v, [actionId]: r }));
      } catch {
        setActionValid((v) => ({ ...v, [actionId]: { valid: false, resolved: "", reason: "校验失败" } }));
      }
    }, 400);
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
      setGameLibraries(s.gameLibraries || []);
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

  // ---------------- File / folder pickers ----------------
  const resolvePicked = (sel: string | string[] | null): string => {
    if (typeof sel === "string" && sel) return sel;
    if (Array.isArray(sel) && sel.length > 0) return sel[0];
    return "";
  };
  const pickExecutable = async (): Promise<string> => {
    try {
      const sel: string | string[] | null = await open({
        title: "选择可执行文件",
        multiple: false,
        filters: [{ name: "程序", extensions: ["exe", "bat", "cmd", "lnk"] }],
      });
      return resolvePicked(sel);
    } catch {
      return "";
    }
  };
  const pickFolder = async (): Promise<string> => {
    try {
      const sel: string | string[] | null = await open({
        title: "选择目录",
        directory: true,
        multiple: false,
      });
      return resolvePicked(sel);
    } catch {
      return "";
    }
  };

  // ---------------- Game actions ----------------
  const saveGameLevel = async (id: string, level: number) => {
    await call("admin_set_game_level", { game_id: id, level });
    setGames((gs) => gs.map((g) => (g.id === id ? { ...g, gameLevel: level } : g)));
    showToast(`已设置等级 ${level}`);
  };

  const openNewGame = () => {
    setEditingGame({ id: "", name: "", gameLevel: 1, developer: [], genre: [], platform: [], category: [] });
    setEditTab("general");
    const f = { name: "", gameLevel: 1, developer: [], genre: [], platform: [], category: [], tags: [], gameLibrary: "", version: "", publisher: [], series: [], releaseDate: "", description: "", guide: "", notes: "", favorite: false, hidden: false, actions: [], preLaunchScript: "", preLaunchEnabled: false, postLaunchScript: "", postLaunchEnabled: false, postExitScript: "", postExitEnabled: false };
    setGameForm(f);
    gameFormInitRef.current = JSON.stringify(f);
    customWorkingDirRef.current = {};
  };
  const openEditGame = (g: Game) => {
    setEditingGame(g);
    setEditTab("general");
    const f = {
      name: g.name,
      gameLevel: g.gameLevel,
      developer: g.developer || [],
      genre: g.genre || [],
      platform: g.platform || [],
      category: g.category || [],
      tags: g.tags || [],
      gameLibrary: g.gameLibrary || "",
      version: g.version || "",
      publisher: g.publisher || [],
      series: g.series || [],
      releaseDate: g.releaseDate || "",
      description: g.description || "",
      guide: g.guide || "",
      notes: g.notes || "",
      favorite: !!g.favorite,
      hidden: !!g.hidden,
      actions: (g.actions || []).map((a) => {
        const p = a.path || "";
        // Working directory default = exe directory (path.parent). Always
        // re-derive so stale/wrong stored values (e.g. `{lib}\X` for an exe at
        // `{lib}\X\Sephiria\Sephiria.exe`) get corrected automatically.
        const correctWd = deriveWorkingDir(p);
        return {
          id: a.id,
          name: a.name || "",
          type: a.type || "File",
          path: p,
          workingDir: correctWd,
          arguments: a.arguments || "",
          isPlayAction: !!a.isPlayAction,
          trackGame: !!a.trackGame,
        };
      }),
      preLaunchScript: g.preLaunchScript || "",
      preLaunchEnabled: !!g.preLaunchEnabled,
      postLaunchScript: g.postLaunchScript || "",
      postLaunchEnabled: !!g.postLaunchEnabled,
      postExitScript: g.postExitScript || "",
      postExitEnabled: !!g.postExitEnabled,
    };
    setGameForm(f);
    gameFormInitRef.current = JSON.stringify(f);
    // Reset custom-workingDir tracking: only entries the user edits in this
    // session will be treated as overrides (anything pre-filled is "default").
    customWorkingDirRef.current = {};
  };

  const saveGame = async () => {
    if (!gameForm.name.trim()) {
      showToast("请输入游戏名称");
      return;
    }
    // No real-filesystem check on save: dev environment differs from the
    // deployed one (games may not yet be copied to the configured library
    // path). Use the manual "校验" button next to each action's path to
    // verify paths when you're ready.
    // Note: game libraries are maintained globally via the game-library CRUD
    // (admin_save_game_library / admin_delete_game_library); they are not
    // re-saved here. Save only the game record itself.
    // Build the payload on top of the existing record (if editing) so all the
    // backend's required fields (installed, playTask, otherTasks, ...) are
    // preserved — otherwise serde fails with "missing field installed".
    const base: Game = editingGame
      ? editingGame
      : {
          id: crypto.randomUUID(),
          name: "",
          gameLevel: 1,
          sortName: null,
          localizedNames: [],
          alternateNames: [],
          gameId: null,
          installDirectory: null,
          playTask: null,
          otherTasks: [],
          lastPlayed: null,
          playCount: 0,
          lastActivity: null,
          playtime: 0,
          added: new Date().toISOString(),
          modified: new Date().toISOString(),
          category: [],
          genre: [],
          developer: [],
          publisher: [],
          tags: [],
          series: [],
          ageRating: [],
          region: [],
          source: [],
          features: [],
          releaseDate: null,
          communityScore: null,
          criticScore: null,
          userScore: null,
          hidden: false,
          favorite: false,
          backgroundImage: null,
          coverImage: null,
          icon: null,
          description: null,
          notes: null,
          version: null,
          platform: [],
          emulator: null,
          completionStatus: null,
          userScoreSet: false,
          manualGame: false,
          pluginId: null,
          links: [],
          actions: [],
          featuresEnabled: false,
          gameLibrary: null,
          guide: null,
          screenshots: [],
          videos: [],
        };
    // Fill in any `undefined` fields from the loaded game (older records
    // may be missing fields the backend now requires — e.g. `installed`).
    const merged: Game = { ...base };
    if (editingGame) {
      for (const [k, v] of Object.entries(editingGame as unknown as Record<string, unknown>)) {
        if (v !== undefined) (merged as unknown as Record<string, unknown>)[k] = v;
      }
    }
    const payload: Game = {
      ...merged,
      id: editingGame?.id || base.id,
      name: gameForm.name.trim(),
      gameLevel: gameForm.gameLevel,
      developer: gameForm.developer,
      genre: gameForm.genre,
      platform: gameForm.platform,
      category: gameForm.category,
      tags: gameForm.tags,
      gameLibrary: gameForm.gameLibrary.trim() || null,
      version: gameForm.version || null,
      publisher: gameForm.publisher,
      series: gameForm.series,
      releaseDate: gameForm.releaseDate || null,
      description: gameForm.description || null,
      guide: gameForm.guide || null,
      notes: gameForm.notes || null,
      favorite: gameForm.favorite,
      hidden: gameForm.hidden,
      actions: gameForm.actions,
      preLaunchScript: gameForm.preLaunchScript || null,
      preLaunchEnabled: !!gameForm.preLaunchEnabled,
      postLaunchScript: gameForm.postLaunchScript || null,
      postLaunchEnabled: !!gameForm.postLaunchEnabled,
      postExitScript: gameForm.postExitScript || null,
      postExitEnabled: !!gameForm.postExitEnabled,
      modified: new Date().toISOString(),
    };
    try {
      await call("save_game", { payload: { game: payload } });
      showToast(editingGame?.id ? "已保存游戏" : "已新增游戏");
      setEditingGame(null);
      await reload();
    } catch (e) {
      showToast(`保存失败: ${String(e)}`);
    }
  };

  const deleteGame = async (id: string, name: string) => {
    askConfirm(`确定删除游戏《${name}》？`, async () => {
      try {
        const target = games.find((g) => g.id === id);
        await call("delete_game", { id });
        setGames((gs) => gs.filter((g) => g.id !== id));
        setUndoState({
          message: `已删除游戏「${name}」`,
          onUndo: async () => {
            if (target) {
              await call("save_game", { payload: { game: target } });
              showToast(`已恢复游戏「${name}」`);
            }
            await reload();
          },
        });
      } catch (e) {
        showToast(`删除失败: ${String(e)}`);
      }
    });
  };

  // ---- Action list editing helpers ----
  const updateAction = (idx: number, patch: Partial<GameAction>) => {
    setGameForm((f) => {
      const actions = f.actions.map((a, i) => (i === idx ? { ...a, ...patch } : a));
      // Keep exactly one play action: if the patched action is the play action,
      // clear isPlayAction on all others.
      if (patch.isPlayAction === true) {
        actions.forEach((a, i) => { if (i !== idx) a.isPlayAction = false; });
      }
      return { ...f, actions };
    });
  };
  const addAction = () => {
    const type = "File";
    const isPlayAction = gameForm.actions.length === 0;
    const action: GameAction = {
      id: crypto.randomUUID(),
      name: isPlayAction ? "启动游戏" : `启动项 ${gameForm.actions.length + 1}`,
      type,
      path: "",
      workingDir: "",
      arguments: "",
      isPlayAction,
      trackGame: type === "File",
    };
    setGameForm((f) => ({ ...f, actions: [...f.actions, action] }));
  };
  const removeAction = (idx: number) => {
    setGameForm((f) => {
      const actions = f.actions.filter((_, i) => i !== idx);
      // If we removed the play action, promote the first remaining one.
      if (!actions.some((a) => a.isPlayAction) && actions.length > 0) {
        actions[0].isPlayAction = true;
      }
      return { ...f, actions };
    });
  };
  const moveAction = (idx: number, dir: -1 | 1) => {
    setGameForm((f) => {
      const target = idx + dir;
      if (target < 0 || target >= f.actions.length) return f;
      const actions = [...f.actions];
      [actions[idx], actions[target]] = [actions[target], actions[idx]];
      return { ...f, actions };
    });
  };
  // ---- Game-library CRUD (like the games / users tables) ----
  const openNewLibrary = () => {
    setEditingLibrary({ id: "", name: `库${gameLibraries.length + 1}`, path: "" });
    const f = { id: "", name: `库${gameLibraries.length + 1}`, path: "" };
    setLibraryForm(f);
    libraryFormInitRef.current = JSON.stringify(f);
  };
  const openEditLibrary = (l: GameLibrary) => {
    setEditingLibrary(l);
    const f = { id: l.id, name: l.name, path: l.path };
    setLibraryForm(f);
    libraryFormInitRef.current = JSON.stringify(f);
  };
  const saveLibrary = async () => {
    if (!libraryForm.name.trim() || !libraryForm.path.trim()) {
      showToast("名称和路径不能为空");
      return;
    }
    try {
      const libs = await call<GameLibrary[]>("admin_save_game_library", {
        library: { id: libraryForm.id, name: libraryForm.name.trim(), path: libraryForm.path.trim() },
      });
      setGameLibraries(libs);
      if (settings) setSettings({ ...settings, gameLibraries: libs });
      setEditingLibrary(null);
      showToast(libraryForm.id ? "已更新游戏库" : "已新增游戏库");
      await reload();
    } catch (e) {
      showToast(`保存失败: ${String(e)}`);
    }
  };
  const deleteLibrary = async (id: string, name: string) => {
    askConfirm(`确定删除游戏库「${name}」？删除后可在底部撤销恢复。`, async () => {
      try {
        const target = gameLibraries.find((l) => l.id === id);
        await call<GameLibrary[]>("admin_delete_game_library", { id });
        setGameLibraries((ls) => ls.filter((l) => l.id !== id));
        if (settings) setSettings({ ...settings, gameLibraries: settings.gameLibraries.filter((l) => l.id !== id) });
        setUndoState({
          message: `已删除游戏库「${name}」`,
          onUndo: async () => {
            if (target) {
              await call<GameLibrary[]>("admin_save_game_library", { library: target });
              showToast(`已恢复游戏库「${name}」`);
            }
            await reload();
          },
        });
      } catch (e) {
        showToast(`删除失败: ${String(e)}`);
      }
    });
  };

  // ---------------- User actions ----------------
  const openNewUser = () => {
    setEditingUser({ id: "", account: "", name: "", level: 1, createdAt: "" });
    const f = { id: "", account: "", name: "", level: 1, kind: "personal", password: "" };
    setUserForm(f);
    userFormInitRef.current = JSON.stringify(f);
  };
  const openEditUser = (u: PublicUser) => {
    setEditingUser(u);
    const f = { id: u.id, account: u.account, name: u.name, level: u.level, kind: u.kind || "personal", password: "" };
    setUserForm(f);
    userFormInitRef.current = JSON.stringify(f);
  };
  const saveUser = async () => {
    if (!userForm.account.trim()) {
      showToast("请输入账号");
      return;
    }
    if (!userForm.id && !userForm.password) {
      showToast("新增用户必须填写密码");
      return;
    }
    try {
      await call<PublicUser>("admin_save_user", {
        id: userForm.id,
        account: userForm.account.trim(),
        name: userForm.name,
        level: userForm.level,
        kind: userForm.kind,
        password: userForm.password,
      });
      setEditingUser(null);
      showToast(userForm.id ? "已保存用户" : "已新增用户");
      await reload();
    } catch (e) {
      showToast(`保存失败: ${String(e)}`);
    }
  };
  const deleteUser = async (id: string, account: string) => {
    askConfirm(`确定删除用户「${account}」？删除后可在底部撤销恢复。`, async () => {
      try {
        const target = users.find((u) => u.id === id);
        await call("admin_delete_user", { id });
        setUsers((us) => us.filter((u) => u.id !== id));
        setUndoState({
          message: `已删除用户「${account}」`,
          onUndo: async () => {
            if (target) {
              await call("admin_restore_user", { id: target.id });
              showToast(`已恢复用户「${account}」`);
            }
            await reload();
          },
        });
      } catch (e) {
        showToast(`删除失败: ${String(e)}`);
      }
    });
  };

  // Filter games for search
  const [query, setQuery] = useState("");
  const filteredGames = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) => g.name.toLowerCase().includes(q));
  }, [games, query]);

  // All unique tags across the whole library (for the tag picker).
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const g of games) {
      for (const t of g.tags || []) if (t.trim()) set.add(t.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [games]);

  // Toggle a tag on the game being edited (used by the tag picker).
  const toggleTag = (tag: string) => {
    setGameForm((f) => {
      const t = tag.trim();
      if (!t) return f;
      const has = f.tags.includes(t);
      const tags = has ? f.tags.filter((x) => x !== t) : [...f.tags, t];
      return { ...f, tags };
    });
  };

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
          <button className={tab === "libraries" ? "active" : ""} onClick={() => setTab("libraries")}>
            游戏库管理
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
                  <th>ID</th>
                  <th>名称</th>
                  <th>等级</th>
                  <th>安装目录</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredGames.map((g) => {
                  const play = (g.actions || []).find((a) => a.isPlayAction) || (g.actions || [])[0];
                  const actionCount = (g.actions || []).length;
                  return (
                  <tr key={g.id}>
                    <td className="mono">{g.id || "—"}</td>
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
                          {actionCount > 1 && <span className="muted"> 等{actionCount}项</span>}
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
                  <th>ID</th>
                  <th>账号</th>
                  <th>名称</th>
                  <th>类别</th>
                  <th>等级</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="mono">{u.id || "—"}</td>
                    <td>{u.account}</td>
                    <td>{u.name}</td>
                    <td>
                      <span className={`kind-tag ${u.kind === "enterprise" ? "ent" : "per"}`}>
                        {u.kind === "enterprise" ? "企业用户" : "个人用户"}
                      </span>
                    </td>
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

        {tab === "libraries" && (
          <section className="admin-panel">
            <div className="panel-head">
              <span>游戏库（某个目录下游戏的集合，名称可用作路径占位符）</span>
              <button onClick={openNewLibrary}>+ 新增游戏库</button>
            </div>
            <p className="hint">
              每个游戏库 = <strong>名称</strong>（可修改，如"库1"、"库2"）+ <strong>路径</strong>
              （游戏所在根目录）。启动项路径用 <code>{"{名称}"}</code> 作为前缀，运行时自动替换为对应
              目录。例如：名称填 <code>库1</code>、路径填 <code>D:\Games</code>，则
              <code>{"{库1}\\Y\\Helldivers"}</code> 解析为 <code>D:\Games\Y\Helldivers</code>。
            </p>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>名称</th>
                  <th>路径</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {gameLibraries.map((lib) => (
                  <tr key={lib.id || lib.name}>
                    <td className="mono">{lib.id || "—"}</td>
                    <td>
                      <span className="lib-token">{`{${lib.name}}`}</span>
                    </td>
                    <td className="action-path">
                      <code title={lib.path}>{lib.path}</code>
                    </td>
                    <td className="row-actions">
                      <button onClick={() => openEditLibrary(lib)}>编辑</button>
                      <button className="danger" onClick={() => void deleteLibrary(lib.id, lib.name)}>
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
                {gameLibraries.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-cell">暂无游戏库。点击"新增游戏库"添加。</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}
      </main>

      {/* ---------------- Game editor modal (multi-tab) ---------------- */}
      {editingGame && (
        <ModalMask>
          <div className="admin-modal admin-modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3>{editingGame.id ? "编辑游戏" : "新增游戏"}</h3>

            <div className="edit-tabs">
              <button className={editTab === "general" ? "active" : ""} onClick={() => setEditTab("general")}>
                通用
              </button>
              <button className={editTab === "actions" ? "active" : ""} onClick={() => setEditTab("actions")}>
                指令
              </button>
              <button className={editTab === "scripts" ? "active" : ""} onClick={() => setEditTab("scripts")}>
                脚本
              </button>
            </div>

            {editTab === "general" && (
              <div className="edit-pane">
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
                <label>
                  开发者（逗号分隔）
                  <input value={gameForm.developer.join(",")} onChange={(e) => setGameForm({ ...gameForm, developer: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} />
                </label>
                <label>
                  类型（逗号分隔）
                  <input value={gameForm.genre.join(",")} onChange={(e) => setGameForm({ ...gameForm, genre: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} />
                </label>
                <label>
                  平台（逗号分隔）
                  <input value={gameForm.platform.join(",")} onChange={(e) => setGameForm({ ...gameForm, platform: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} />
                </label>
                <label>
                  版本
                  <input value={gameForm.version} placeholder="如 1.0.0 / GOTY" onChange={(e) => setGameForm({ ...gameForm, version: e.target.value })} />
                </label>
                <label>
                  发行商（逗号分隔）
                  <input value={gameForm.publisher.join(",")} onChange={(e) => setGameForm({ ...gameForm, publisher: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} />
                </label>
                <label>
                  系列（逗号分隔）
                  <input value={gameForm.series.join(",")} onChange={(e) => setGameForm({ ...gameForm, series: e.target.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean) })} />
                </label>
                <label>
                  发行日期
                  <input type="date" value={gameForm.releaseDate || ""} onChange={(e) => setGameForm({ ...gameForm, releaseDate: e.target.value })} />
                </label>
                <label>
                  收藏 / 隐藏
                  <div className="check-row">
                    <label className="check">
                      <input type="checkbox" checked={gameForm.favorite} onChange={(e) => setGameForm({ ...gameForm, favorite: e.target.checked })} />
                      收藏
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={gameForm.hidden} onChange={(e) => setGameForm({ ...gameForm, hidden: e.target.checked })} />
                      隐藏
                    </label>
                  </div>
                </label>
                <label>
                  所属游戏库
                  <select
                    value={gameForm.gameLibrary || ""}
                    onChange={(e) => setGameForm({ ...gameForm, gameLibrary: e.target.value })}
                  >
                    <option value="">（无 / 未指定）</option>
                    {gameLibraries.map((lib) => (
                      <option key={lib.id || lib.name} value={lib.name}>
                        {lib.name} — {lib.path}
                      </option>
                    ))}
                  </select>
                </label>
                {gameLibraries.length === 0 && (
                  <p className="hint" style={{ marginTop: -4 }}>
                    暂未配置任何游戏库。请到<strong>游戏库管理</strong>标签页添加。
                  </p>
                )}
                <div className="label-block">
                  <label>标签（点选已有标签，或输入新标签后按回车）</label>
                  <div className="tag-picker">
                    {allTags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`tag-chip ${gameForm.tags.includes(t) ? "on" : ""}`}
                        onClick={() => toggleTag(t)}
                      >
                        {t}
                      </button>
                    ))}
                    {allTags.length === 0 && (
                      <span className="hint">暂无标签，可在下方输入新标签。</span>
                    )}
                  </div>
                  <div className="path-row">
                    <input
                      placeholder="输入新标签，回车添加"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = (e.target as HTMLInputElement).value.trim();
                          if (v) {
                            toggleTag(v);
                            (e.target as HTMLInputElement).value = "";
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                        const v = (input?.value || "").trim();
                        if (v) {
                          toggleTag(v);
                          input.value = "";
                        }
                      }}
                    >
                      添加
                    </button>
                  </div>
                  <div className="selected-tags">
                    {gameForm.tags.map((t) => (
                      <span key={t} className="tag-chip on readonly">{t} ✕</span>
                    ))}
                  </div>
                </div>
                <div className="label-block">
                  <label>简介 / 描述</label>
                  <textarea
                    rows={3}
                    value={gameForm.description || ""}
                    placeholder="游戏简介（纯文本）"
                    onChange={(e) => setGameForm({ ...gameForm, description: e.target.value })}
                  />
                </div>
                <div className="label-block">
                  <label>HTML 攻略 / 玩法指南</label>
                  <textarea
                    rows={5}
                    value={gameForm.guide || ""}
                    placeholder="支持 HTML，展示在详情页"
                    onChange={(e) => setGameForm({ ...gameForm, guide: e.target.value })}
                  />
                </div>
                <div className="label-block">
                  <label>备注</label>
                  <textarea
                    rows={2}
                    value={gameForm.notes || ""}
                    placeholder="内部备注（不出现在客户端）"
                    onChange={(e) => setGameForm({ ...gameForm, notes: e.target.value })}
                  />
                </div>
              </div>
            )}

            {editTab === "actions" && (
              <div className="edit-pane">
                <div className="actions-head">
                  <span>启动项（支持多种：原版 / MOD / DX11 / DX12 等，可添加多条）</span>
                  <button onClick={addAction}>+ 添加启动项</button>
                </div>
                {gameForm.actions.length === 0 ? (
                  <p className="hint">
                    暂无启动项。点击"添加启动项"配置一个（文件或 URL）。留空则客户端自动扫描安装目录。
                  </p>
                ) : (
                  <div className="actions-list">
                    {gameForm.actions.map((a, idx) => (
                      <div className={`action-card ${a.isPlayAction ? "play" : ""}`} key={a.id}>
                        <div className="action-card-head">
                          <span className="action-idx">#{idx + 1}</span>
                          <input
                            className="action-name"
                            placeholder="启动项名称（如：原版 / MOD / DX11 / DX12）"
                            value={a.name}
                            onChange={(e) => updateAction(idx, { name: e.target.value })}
                          />
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={!!a.isPlayAction}
                              onChange={(e) => updateAction(idx, { isPlayAction: e.target.checked })}
                            />
                            作为启动指令
                          </label>
                          <div className="action-tools">
                            <button title="上移" disabled={idx === 0} onClick={() => moveAction(idx, -1)}>↑</button>
                            <button title="下移" disabled={idx === gameForm.actions.length - 1} onClick={() => moveAction(idx, 1)}>↓</button>
                            <button className="danger" title="移除" onClick={() => removeAction(idx)}>✕</button>
                          </div>
                        </div>
                        <div className="action-grid">
                          <label>
                            类型
                            <select value={a.type} onChange={(e) => updateAction(idx, { type: e.target.value, path: e.target.value === "URL" ? (a.path?.startsWith("http") ? a.path : "") : a.path })}>
                              <option value="File">文件（启动程序）</option>
                              <option value="URL">URL（打开链接）</option>
                            </select>
                          </label>
                          <label className="wide">
                            {a.type === "URL" ? "URL 地址" : "路径（支持 {GamelibraryN} 占位符）"}
                            <div className="path-row">
                              <input
                                value={a.path || ""}
                                placeholder={a.type === "URL" ? "https://…" : "{Gamelibrary1}\\Game\\Game.exe"}
                                onChange={(e) => {
                                  const newPath = e.target.value;
                                  const patch: Partial<GameAction> = { path: newPath };
                                  // While the user hasn't customized workingDir,
                                  // keep it in sync with the exe directory.
                                  if (!customWorkingDirRef.current[a.id]) {
                                    patch.workingDir = deriveWorkingDir(newPath);
                                  }
                                  updateAction(idx, patch);
                                }}
                              />
                              {a.type !== "URL" && (
                                <button type="button" onClick={async () => {
                                  const p = await pickExecutable();
                                  if (p) updateAction(idx, { path: p });
                                }}>浏览…</button>
                              )}
                              {a.type !== "URL" && (
                                <button
                                  type="button"
                                  className="valid-btn"
                                  title="在真实文件系统上校验此路径（手动触发，不影响保存）"
                                  onClick={() => validateAction(a.id, a.path || "", a.type)}
                                >
                                  校验
                                </button>
                              )}
                            </div>
                            {a.type !== "URL" && actionValid[a.id] && (
                              <div className={`action-valid ${actionValid[a.id].valid ? "ok" : "bad"}`}>
                                {actionValid[a.id].valid ? (
                                  <>✓ 可执行</>
                                ) : (
                                  <>✕ {actionValid[a.id].reason}</>
                                )}
                                {actionValid[a.id].resolved && (
                                  <code className="resolved" title={actionValid[a.id].resolved}>
                                    {actionValid[a.id].resolved}
                                  </code>
                                )}
                              </div>
                            )}
                          </label>
                          {a.type !== "URL" && (
                            <>
                              <label className="wide">
                                工作目录（默认 = exe 所在目录，如 {"{Gamelibrary1}"}\\X\\Sephiria；填错游戏启动不了）
                                <div className="path-row">
                                  <input
                                    value={a.workingDir || ""}
                                    placeholder="自动 = exe 所在目录，可修改（如 {Gamelibrary1}\\X\\Sephiria 或其子目录 \\bin）"
                                    onChange={(e) => {
                                      // User has explicitly edited workingDir — stop auto-sync.
                                      customWorkingDirRef.current[a.id] = true;
                                      updateAction(idx, { workingDir: e.target.value });
                                    }}
                                  />
                                  <button type="button" onClick={async () => {
                                    const p = await pickFolder();
                                    if (p) updateAction(idx, { workingDir: p });
                                  }}>浏览…</button>
                                  <button
                                    type="button"
                                    className="valid-btn"
                                    title="便捷填充：工作目录设为 exe 所在目录（exe.parent）。注意：很多游戏的工作目录是 exe.parent 的子目录（如 \\bin），需要手动修改。"
                                    onClick={async () => {
                                      try {
                                        const r = await call<{ valid: boolean; resolved: string }>(
                                          "admin_validate_action",
                                          { path: a.path || "", type: a.type || "File" }
                                        );
                                        // resolved 是 exe 绝对路径；取其 parent
                                        const exe = r.resolved.replace(/[\\/]+$/, "");
                                        const sep = exe.includes("\\") ? "\\" : "/";
                                        const parent = exe.substring(0, exe.lastIndexOf(sep));
                                        updateAction(idx, { workingDir: parent });
                                        showToast(`工作目录已设为：${parent}`);
                                      } catch (e) {
                                        showToast(`失败: ${String(e)}`);
                                      }
                                    }}
                                  >
                                    用 exe 所在目录
                                  </button>
                                </div>
                              </label>
                              <label>
                                启动参数
                                <input
                                  value={a.arguments || ""}
                                  placeholder="如 --windowed --high"
                                  onChange={(e) => updateAction(idx, { arguments: e.target.value })}
                                />
                              </label>
                              <label>
                                追踪游玩时间
                                <select value={a.trackGame ? "yes" : "no"} onChange={(e) => updateAction(idx, { trackGame: e.target.value === "yes" })}>
                                  <option value="yes">追踪</option>
                                  <option value="no">不追踪</option>
                                </select>
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom of the actions tab: read-only summary of referenced
                    libraries + one-shot path migration helper. */}
                <div className="actions-head" style={{ marginTop: 16 }}>
                  <span>此启动项引用的游戏库（只读）</span>
                </div>
                {(() => {
                  const used = new Set<string>();
                  for (const a of gameForm.actions) {
                    for (const k of ["path", "workingDir"] as const) {
                      const v = a[k];
                      if (!v) continue;
                      const m = v.match(/\{([^}]+)\}/g);
                      if (m) m.forEach((t) => used.add(t.slice(1, -1)));
                    }
                  }
                  if (used.size === 0) {
                    return <p className="hint">未在启动项路径中引用任何游戏库占位符。</p>;
                  }
                  return (
                    <div className="tag-picker">
                      {Array.from(used).map((name) => (
                        <span key={name} className="lib-token">{`{${name}}`}</span>
                      ))}
                    </div>
                  );
                })()}

                <div className="actions-head" style={{ marginTop: 16 }}>
                  <span>迁移旧路径（一次性，将全库 .\Gamelibrary\ 升级为 {"{Gamelibrary1}"}）</span>
                  <button
                    onClick={() => {
                      askConfirm(
                        "将所有游戏的启动项路径从旧的 .\\Gamelibrary\\ 升级为 {Gamelibrary1}\\ 占位符？",
                        async () => {
                          try {
                            const r = await call<{ scanned: number; updated: number; examples: string[] }>(
                              "admin_migrate_gamelibrary_placeholder"
                            );
                            showToast(`迁移完成：扫描 ${r.scanned}，更新 ${r.updated}`);
                            await reload();
                          } catch (e) {
                            showToast(`迁移失败: ${String(e)}`);
                          }
                        }
                      );
                    }}
                  >
                    迁移旧路径
                  </button>
                </div>
              </div>
            )}

            {editTab === "scripts" && (
              <div className="edit-pane">
                <p className="hint">
                  脚本在客户端启动/退出游戏时执行。每行一条命令（如{" "}
                  <code>config.exe</code>、<code>reg.exe import 1.reg</code>），
                  支持变量：<code>{"{InstallDir}"}</code> <code>{"{GameName}"}</code>{" "}
                  <code>{"{AppDir}"}</code>。以 <code>#</code> 开头的行为注释。
                </p>

                {/* 启动游戏前 */}
                <div className="script-editor">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={gameForm.preLaunchEnabled}
                      onChange={(e) => setGameForm((f) => ({ ...f, preLaunchEnabled: e.target.checked }))}
                    />
                    启动游戏前执行
                  </label>
                  <textarea
                    rows={4}
                    placeholder="每行一条命令，在启动游戏 exe 前执行"
                    value={gameForm.preLaunchScript}
                    onChange={(e) => setGameForm((f) => ({ ...f, preLaunchScript: e.target.value }))}
                  />
                  <div className="script-tools">
                    <button type="button" onClick={() => void runTestScript("pre")}>测试脚本</button>
                  </div>
                  {scriptTest.pre && (
                    <div className="script-result">
                      {scriptTest.pre.map((r, i) => (
                        <div key={i} className={r.ok ? "ok" : "bad"}>
                          {r.ok ? "✓" : "✕"} {r.line}
                          {r.error ? <span className="err"> — {r.error}</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 启动游戏后 */}
                <div className="script-editor">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={gameForm.postLaunchEnabled}
                      onChange={(e) => setGameForm((f) => ({ ...f, postLaunchEnabled: e.target.checked }))}
                    />
                    启动游戏后执行
                  </label>
                  <textarea
                    rows={4}
                    placeholder="每行一条命令，游戏进程启动后执行"
                    value={gameForm.postLaunchScript}
                    onChange={(e) => setGameForm((f) => ({ ...f, postLaunchScript: e.target.value }))}
                  />
                  <div className="script-tools">
                    <button type="button" onClick={() => void runTestScript("postLaunch")}>测试脚本</button>
                  </div>
                  {scriptTest.postLaunch && (
                    <div className="script-result">
                      {scriptTest.postLaunch.map((r, i) => (
                        <div key={i} className={r.ok ? "ok" : "bad"}>
                          {r.ok ? "✓" : "✕"} {r.line}
                          {r.error ? <span className="err"> — {r.error}</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 退出游戏后 */}
                <div className="script-editor">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={gameForm.postExitEnabled}
                      onChange={(e) => setGameForm((f) => ({ ...f, postExitEnabled: e.target.checked }))}
                    />
                    退出游戏后执行
                  </label>
                  <textarea
                    rows={4}
                    placeholder="每行一条命令，游戏退出后执行"
                    value={gameForm.postExitScript}
                    onChange={(e) => setGameForm((f) => ({ ...f, postExitScript: e.target.value }))}
                  />
                  <div className="script-tools">
                    <button type="button" onClick={() => void runTestScript("postExit")}>测试脚本</button>
                  </div>
                  {scriptTest.postExit && (
                    <div className="script-result">
                      {scriptTest.postExit.map((r, i) => (
                        <div key={i} className={r.ok ? "ok" : "bad"}>
                          {r.ok ? "✓" : "✕"} {r.line}
                          {r.error ? <span className="err"> — {r.error}</span> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button onClick={requestCloseGame}>取消</button>
              <button className="primary" onClick={() => void saveGame()}>
                保存
              </button>
            </div>
          </div>
        </ModalMask>
      )}

      {editingLibrary && (
        <ModalMask>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingLibrary.id ? "编辑游戏库" : "新增游戏库"}</h3>
            {editingLibrary.id && (
              <label>
                ID
                <input value={editingLibrary.id} disabled />
              </label>
            )}
            <label>
              名称（用作路径占位符，可改为"库1"、"库2"等）
              <input
                value={libraryForm.name}
                onChange={(e) => setLibraryForm({ ...libraryForm, name: e.target.value })}
              />
            </label>
            <label>
              路径（游戏所在根目录）
              <div className="path-row">
                <input
                  value={libraryForm.path}
                  placeholder="D:\\Games"
                  onChange={(e) => setLibraryForm({ ...libraryForm, path: e.target.value })}
                />
                <button type="button" onClick={async () => {
                  const p = await pickFolder();
                  if (p) setLibraryForm({ ...libraryForm, path: p });
                }}>浏览…</button>
              </div>
            </label>
            <div className="modal-actions">
              <button onClick={requestCloseLibrary}>取消</button>
              <button className="primary" onClick={() => void saveLibrary()}>保存</button>
            </div>
          </div>
        </ModalMask>
      )}

      {editingUser && (
        <ModalMask>
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
              用户类别
              <select value={userForm.kind} onChange={(e) => setUserForm({ ...userForm, kind: e.target.value })}>
                <option value="personal">个人用户</option>
                <option value="enterprise">企业用户</option>
              </select>
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
              <button onClick={requestCloseUser}>取消</button>
              <button className="primary" onClick={() => void saveUser()}>
                保存
              </button>
            </div>
          </div>
        </ModalMask>
      )}

      {/* Custom confirmation dialog (replaces window.confirm) */}
      {confirmState && (
        <div className="admin-modal-mask">
          <div className="admin-modal confirm-modal">
            <p className="confirm-message">{confirmState.message}</p>
            <div className="modal-actions">
              <button onClick={() => setConfirmState(null)}>取消</button>
              <button
                className="danger"
                onClick={() => {
                  const ok = confirmState.onOk;
                  setConfirmState(null);
                  ok();
                }}
              >
                确定删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo bar after a deletion */}
      {undoState && (
        <div className="undo-bar">
          <span>{undoState.message}</span>
          <button
            onClick={() => {
              const undo = undoState.onUndo;
              setUndoState(null);
              void undo();
            }}
          >
            撤销
          </button>
        </div>
      )}
    </div>
  );
}
