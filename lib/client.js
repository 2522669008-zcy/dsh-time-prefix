window.__ModuleLoader__.load({
  id: "dsh-time-prefix",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    let React = require("react");

    // ============ 工具函数：生成当前时间文本 ============
    function formatTime() {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `【${yyyy}/${mm}/${dd}，${hh}:${min}】`;
    }

    // ============ 设置控制器：读写 time-prefix.enabled ============
    function createSnapshotStore(initial) {
      let snapshot = initial;
      const listeners = new Set();
      return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        update: (fn) => {
          const draft = { ...snapshot };
          fn(draft);
          snapshot = draft;
          for (const listener of listeners) listener();
        }
      };
    }

    class SettingsController {
      constructor(api, ns) {
        this.api = api;
        this.ns = ns;
        this.store = createSnapshotStore({
          status: "loading",
          value: undefined,
          writable: false,
          revision: undefined
        });
        this.tail = Promise.resolve();
      }

      getSnapshot() {
        return this.store.getSnapshot();
      }

      subscribe(listener) {
        return this.store.subscribe(listener);
      }

      load() {
        this.tail = this.tail.then(async () => {
          try {
            const response = await this.api.settings.describe({});
            if (!response.result.ok) return;
            const { namespaces, writable } = response.result.value;
            const view = namespaces.find((item) => item.ns === this.ns);
            if (!view) return;
            this.store.update((draft) => {
              draft.status = "ready";
              draft.value = view.value;
              draft.writable = writable === true;
              draft.revision = view.revision;
            });
          } catch {}
        });
        return this.tail;
      }

      setEnabled(value) {
        this.tail = this.tail.then(async () => {
          const revision = this.getSnapshot().revision;
          try {
            const response = await this.api.settings.mutate({
              ns: this.ns,
              ops: [{ op: "set", path: ["enabled"], value }],
              ...(revision === undefined ? {} : { expectedRevision: revision })
            });
            if (response.result.ok) {
              const view = response.result.value;
              this.store.update((draft) => {
                draft.revision = view.revision;
                if (typeof view.value === "object" && view.value !== null) {
                  draft.value = view.value;
                } else {
                  draft.value = { ...(draft.value || {}), enabled: value };
                }
              });
            } else {
              await this.load();
            }
          } catch {
            await this.load();
          }
        });
        return this.tail;
      }
    }

    // ============ 设置页 UI：开关 ============
    function TimePrefixSection({ controller }) {
      const snapshot = React.useSyncExternalStore(
        controller.subscribe.bind(controller),
        controller.getSnapshot.bind(controller)
      );

      const enabled = snapshot.value && snapshot.value.enabled === true;
      const busy = snapshot.status === "loading";
      const writable = snapshot.writable === true;

      const trackStyle = {
        position: "relative",
        flex: "none",
        width: 44,
        height: 24,
        borderRadius: 999,
        border: "1px solid rgba(128,128,128,.35)",
        background: enabled ? "#4c8dff" : "rgba(128,128,128,.18)",
        cursor: "pointer",
        padding: 0
      };

      const knobStyle = {
        position: "absolute",
        top: 2,
        left: enabled ? 22 : 2,
        width: 18,
        height: 18,
        borderRadius: 999,
        background: "#fff",
        transition: "left .15s ease"
      };

      return React.createElement(
        "div",
        { style: { width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 12 } },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 } },
          React.createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 4 } },
            React.createElement("strong", { style: { fontSize: 14 } }, "发送时间前缀"),
            React.createElement("span", { style: { fontSize: 13, color: "rgba(128,128,128,.75)" } },
              "开启后，每条用户消息前会自动插入当前时间")
          ),
          React.createElement(
            "button",
            {
              type: "button",
              role: "switch",
              "aria-checked": enabled,
              disabled: busy || !writable,
              onClick: () => controller.setEnabled(!enabled),
              style: trackStyle
            },
            React.createElement("span", { style: knobStyle })
          )
        )
      );
    }

    // ============ 发送钩子：发送前插入时间 ============
    const HOOK_MARKER = "__dshTimePrefixHooked";

    function installSendHook(conversation, isEnabled) {
      const face = conversation;
      if (!face || typeof face.sendSession !== "function") return;
      if (face[HOOK_MARKER]) return;

      const original = face.sendSession;
      face.sendSession = async (session, text, imageIds, mode) => {
        let finalText = text;
        if (isEnabled()) {
          finalText = `${formatTime()}\n${text}`;
        }
        return original.call(face, session, finalText, imageIds, mode);
      };

      face[HOOK_MARKER] = true;
    }

    // ============ 插件入口 ============
    function apply(ctx) {
      const connection = ctx.get("connection");
      if (!connection) return;

      const controller = new SettingsController(connection.api, "time-prefix");
      const isEnabled = () => {
        const snap = controller.getSnapshot();
        return snap.value ? snap.value.enabled !== false : true;
      };

      const conversation = ctx.get("conversation");
      if (conversation) {
        installSendHook(conversation, isEnabled);
      }

      ctx.slots.inject(
        "settings.section",
        () => ctx.slots.register(
          {
            name: "settings.section",
            id: "time-prefix",
            order: 30,
            label: () => "时间前缀",
            inject: () => ({ controller })
          },
          TimePrefixSection
        )
      );

      controller.load();
    }

    module.exports = {
      apply,
      inject: ["slots", "connection", "conversation"]
    };

    return module.exports;
  }
});