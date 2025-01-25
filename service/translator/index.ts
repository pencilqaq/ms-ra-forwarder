import { createHmac, randomUUID } from 'crypto'
import { Buffer } from 'buffer'

export const FORMAT_CONTENT_TYPE = new Map<string, string>([
  ['raw-16khz-16bit-mono-pcm', 'audio/basic'],
  ['raw-48khz-16bit-mono-pcm', 'audio/basic'],
  ['raw-8khz-8bit-mono-mulaw', 'audio/basic'],
  ['raw-8khz-8bit-mono-alaw', 'audio/basic'],

  ['raw-16khz-16bit-mono-truesilk', 'audio/SILK'],
  ['raw-24khz-16bit-mono-truesilk', 'audio/SILK'],

  ['riff-16khz-16bit-mono-pcm', 'audio/x-wav'],
  ['riff-24khz-16bit-mono-pcm', 'audio/x-wav'],
  ['riff-48khz-16bit-mono-pcm', 'audio/x-wav'],
  ['riff-8khz-8bit-mono-mulaw', 'audio/x-wav'],
  ['riff-8khz-8bit-mono-alaw', 'audio/x-wav'],

  ['audio-16khz-32kbitrate-mono-mp3', 'audio/mpeg'],
  ['audio-16khz-64kbitrate-mono-mp3', 'audio/mpeg'],
  ['audio-16khz-128kbitrate-mono-mp3', 'audio/mpeg'],
  ['audio-24khz-48kbitrate-mono-mp3', 'audio/mpeg'],
  ['audio-24khz-96kbitrate-mono-mp3', 'audio/mpeg'],
  ['audio-24khz-160kbitrate-mono-mp3', 'audio/mpeg'],
  ['audio-48khz-96kbitrate-mono-mp3', 'audio/mpeg'],
  ['audio-48khz-192kbitrate-mono-mp3', 'audio/mpeg'],

  ['webm-16khz-16bit-mono-opus', 'audio/webm; codec=opus'],
  ['webm-24khz-16bit-mono-opus', 'audio/webm; codec=opus'],

  ['ogg-16khz-16bit-mono-opus', 'audio/ogg; codecs=opus; rate=16000'],
  ['ogg-24khz-16bit-mono-opus', 'audio/ogg; codecs=opus; rate=24000'],
  ['ogg-48khz-16bit-mono-opus', 'audio/ogg; codecs=opus; rate=48000'],
])

export const SERVER_AREA_LIST = new Set<string>([
  'southafricanorth',
  'eastasia',
  'southeastasia',
  'australiaeast',
  'centralindia',
  'japaneast',
  'japanwest',
  'koreacentral',
  'canadacentral',
  'northeurope',
  'westeurope',
  'francecentral',
  'germanywestcentral',
  'norwayeast',
  'swedencentral',
  'switzerlandnorth',
  'switzerlandwest',
  'uksouth',
  'uaenorth',
  'brazilsouth',
  'qatarcentral',
  'centralus',
  'eastus',
  'eastus2',
  'northcentralus',
  'southcentralus',
  'westcentralus',
  'westus',
  'westus2',
  'westus3',
])

export const endpoint = 'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0'

interface ServerToken {
  r: string
  t: string
}

export class Service {
  private timer: NodeJS.Timer | null = null
  private serverToken: ServerToken | null = null
  private lastCacheTime: number | null = null
  private cacheExpiresAt: number | null = null
  public getSign(url: string) {
    let formatDate = new Date().toUTCString().replace(' GMT', 'GMT')
    let endcodeUrl = encodeURIComponent(url.replace('https://', ''))
    let uuid = randomUUID().replace(/-/g, '')
    let byte = ('MSTranslatorAndroidApp' + endcodeUrl + formatDate + uuid).toLowerCase()
    let secretKey = Buffer.from(
      'oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==',
      'base64'
    )
    const hmac = createHmac('sha256', secretKey)
    hmac.update(byte)
    let signBase64 = hmac.digest('base64')
    let sign = 'MSTranslatorAndroidApp::' + signBase64 + '::' + formatDate + '::' + uuid
    return sign
  }
  public async httpPost(url, body, headers, resType = 'json') {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: body,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`)
      }

      switch (resType) {
        case 'json':
          return response.json()
        case 'text':
          return response.text()
        case 'blob':
          return response.blob()
        case 'arrayBuffer':
          return response.arrayBuffer()
        default:
          throw new Error('Unsupported response type')
      }
    } catch (error) {
      console.error('Error:', error.message)
      throw error
    }
  }
  public async getEndpoint(url: string) {
    let sign = this.getSign(url)
    let headers = {
      'Accept-Language': 'zh-Hans',
      'X-ClientVersion': '4.0.530a 5fe1dc6c',
      'X-UserId': '0f04d16a175c411e',
      'X-HomeGeographicRegion': 'zh-Hans-CN',
      'X-ClientTraceId': 'aab069b9-70a7-4844-a734-96cd78d94be9',
      'X-MT-Signature': sign,
      'User-Agent': 'okhttp/4.5.0',
      'Content-Type': 'application/json; charset=utf-8',
      'Accept-Encoding': 'gzip',
    }
    return this.httpPost(url, '', headers)
  }
  public async getAudio(r: string, t: string, ssml: string, format: string) {
    let headers = {
      'x-forwarded-for': '13.104.54.77',
      authorization: t,
      'x-microsoft-outputformat': format,
      'content-type': 'application/ssml+xml',
      'accept-encoding': 'gzip, deflate, br',
    }
    let result = this.httpPost(
      'https://' + r + '.tts.speech.microsoft.com/cognitiveservices/v1',
      ssml,
      headers,
      'arrayBuffer'
    )
    return Buffer.from(await result)
  }
  public async convert(ssml, format, serverArea?: string) {
    // 检查是否需要重新获取 s 和 t
    if (this.serverToken === null || Date.now() > this.cacheExpiresAt) {
      // 重新获取 s 和 t
      console.debug('获取serverToken...\r')
      this.serverToken = await this.getEndpoint(endpoint)
      this.lastCacheTime = Date.now()
      this.cacheExpiresAt = this.lastCacheTime + 3600000
    }
    return this.getAudio(serverArea ?? this.serverToken.r, this.serverToken.t, ssml, format)
  }
}

export const service = new Service()
