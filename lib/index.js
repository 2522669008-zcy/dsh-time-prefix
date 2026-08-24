import z from '@deepseek-ai/schemastery';
import { installSettingsSection } from '@deepseek-ai/dsh-settings';

/** Cordis plugin name — must match cordis.patch.yml 里的 name。 */
export const name = 'dsh-time-prefix';

/** 这个 host 插件不需要额外服务。 */
export const inject = [];//如需网络服务，则其属性值为['WebServer']

/** 设置项：只有一个 enabled 开关，默认 true。 */
export const Config = z.object({
  enabled: z.boolean().default(true)
});

/** 设置命名空间，浏览器端也用它。 */
const NS = 'time-prefix';

export function apply(ctx, config = {}) {
  let current = () => config;

  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => {
      current = source;
    },
    onChange: () => {}
  });
}