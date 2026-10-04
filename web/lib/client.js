window.__ModuleLoader__.load({
  id: "dsh-time-prefix",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

    let React = require("react");

    /**
     * Host settings namespace for this plugin. It is the profile entry id from
     * cordis.patch.yml, not a name the plugin invents: the settings service
     * addresses every configurable plugin by its entry id.
     */
    var NS = "dsh-time-prefix";

    /** The switch we render, read from the form snapshot's decoded value. */
    function isEnabled(snapshot) {
      return snapshot.value ? snapshot.value.enabled !== false : true;
    }

    /**
     * Settings card for the send-time prefix. Reads and writes go through the
     * shared ConfigForm the settings service owns for our entry, so revisions and
     * conflict recovery stay the service's business.
     */
    function TimePrefixSection({ form }) {
      var snapshot = React.useSyncExternalStore(
        React.useCallback((listener) => form.subscribe(listener), [form]),
        React.useCallback(() => form.getSnapshot(), [form])
      );

      var [busy, setBusy] = React.useState(false);
      var [failed, setFailed] = React.useState(false);

      var enabled = isEnabled(snapshot);
      var writable = snapshot.writable === true;
      var disabled = busy || !writable;

      var trackStyle = {
        position: "relative",
        flex: "none",
        width: 44,
        height: 24,
        borderRadius: 999,
        border: "1px solid rgba(128,128,128,.35)",
        background: enabled ? "#4c8dff" : "rgba(128,128,128,.18)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        padding: 0
      };

      var knobStyle = {
        position: "absolute",
        top: 2,
        left: enabled ? 22 : 2,
        width: 18,
        height: 18,
        borderRadius: 999,
        background: "#fff",
        transition: "left .15s ease"
      };

      var label = "发送时间前缀";
      var description = "开启后，每条用户消息前会自动插入当前时间（精确到分钟）";
      var unavailable = snapshot.status === "unavailable"
        ? "当前部署无法保存该设置"
        : "当前设置不可修改";

      return React.createElement(
        "div",
        { style: { width: "100%", maxWidth: 760, display: "flex", flexDirection: "column", gap: 12 } },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 } },
          React.createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 4 } },
            React.createElement("strong", { style: { fontSize: 14 } }, label),
            React.createElement("span", { style: { fontSize: 13, color: "rgba(128,128,128,.75)" } }, description),
            failed
              ? React.createElement("span", { role: "alert", style: { fontSize: 12, color: "#e5484d" } }, "保存失败，请重试")
              : null,
            !writable && snapshot.status !== "loading"
              ? React.createElement("span", { style: { fontSize: 12, color: "rgba(128,128,128,.75)" } }, unavailable)
              : null
          ),
          React.createElement(
            "button",
            {
              type: "button",
              role: "switch",
              "aria-checked": enabled,
              "aria-label": label,
              disabled: disabled,
              onClick: () => {
                setFailed(false);
                setBusy(true);
                Promise.resolve(form.set("enabled", !enabled))
                  .then((accepted) => {
                    if (accepted === false) setFailed(true);
                  })
                  .catch(() => setFailed(true))
                  .finally(() => setBusy(false));
              },
              style: trackStyle
            },
            React.createElement("span", { style: knobStyle })
          )
        )
      );
    }

    function apply(ctx) {
      if (!ctx.configForms) return;

      // One shared form per Host entry, owned by the settings provider.
      var form = ctx.configForms.get(NS);

      ctx.slots.inject("settings.section", () => ctx.slots.register(
        {
          name: "settings.section",
          id: "time-prefix",
          order: 30,
          label: () => "时间前缀",
          inject: () => ({ form })
        },
        TimePrefixSection
      ));
    }

    module.exports = {
      apply,
      inject: ["slots", "configForms"]
    };

    return module.exports;
  }
});
