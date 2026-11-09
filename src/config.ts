const bakedKey = (import.meta.env.VITE_API_KEY as string | undefined)?.trim() || ''

/** 构建时可写入环境变量，让所有终端用户共用你的 DeepSeek 配置 */
export const appConfig = {
  apiBaseUrl:
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    'https://api.deepseek.com/v1',
  apiKey: bakedKey,
  modelName:
    (import.meta.env.VITE_MODEL_NAME as string | undefined)?.trim() ||
    'deepseek-flash',
  sendImages: import.meta.env.VITE_SEND_IMAGES !== 'false',
  /** 有共享 Key 且声明锁定时，设置里不可改 API */
  lockApiSettings:
    !!bakedKey && import.meta.env.VITE_LOCK_API_SETTINGS !== 'false',
}

export function defaultAppSettings() {
  return {
    id: 'main' as const,
    apiBaseUrl: appConfig.apiBaseUrl,
    apiKey: appConfig.apiKey,
    modelName: appConfig.modelName,
    sendImages: appConfig.sendImages,
    detailTemplate: 'textbook' as const,
  }
}
