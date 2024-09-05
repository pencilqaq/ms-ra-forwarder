import { createHmac, randomUUID } from 'crypto'
import { Buffer } from 'buffer'

export const FORMAT_CONTENT_TYPE = new Map([
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

export const endpoint =
  'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0'

interface PromiseExecutor {
  resolve: (value?: any) => void
  reject: (reason?: any) => void
}


export class Service {
  private timer: NodeJS.Timer | null = null
  private serverToken: any | null = null
  private lastExecutionTime = 0
  public getSign(url: string) {
    let formatDate = new Date().toUTCString().replace(' GMT', 'GMT')
    let endcodeUrl = encodeURIComponent(url.replace('https://', ''))
    let uuid = randomUUID().replace(/-/g, '')
    let byte = (
      'MSTranslatorAndroidApp' +
      endcodeUrl +
      formatDate +
      uuid
    ).toLowerCase()
    let secretKey = Buffer.from(
      'oik6PdDdMnOXemTbwvMn9de/h9lFnfBaCWbGMMZqqoSaQaqUOqjVGm5NqsmjcBI1x+sS9ugjB55HEJWRiFXYFw==',
      'base64'
    )
    const hmac = createHmac('sha256', secretKey)
    hmac.update(byte)
    let signBase64 = hmac.digest('base64')
    let sign =
      'MSTranslatorAndroidApp::' + signBase64 + '::' + formatDate + '::' + uuid
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
      // 根据响应类型解析数据
      let data
      switch (resType) {
        case 'json':
          data = await response.json()
          break
        case 'text':
          data = await response.text()
          break
        case 'blob':
          data = await response.blob()
          break
        case 'arrayBuffer':
          data = Buffer.from(new Uint8Array(await response.arrayBuffer()))
          break
        default:
          throw new Error('Unsupported response type')
      }

      return data
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
    let result
    result = await this.httpPost(url, '', headers)
    return result
  }
  public async getAudio(s: string, t: string, ssml: string, format: string) {
    let headers = {
      'x-forwarded-for': '13.104.54.77',
      authorization: t,
      'x-microsoft-outputformat': format,
      'content-type': 'application/ssml+xml',
      'accept-encoding': 'gzip, deflate, br',
    }
    let result
    result = await this.httpPost(
      'https://' + s + '.tts.speech.microsoft.com/cognitiveservices/v1',
      ssml,
      headers,
      'arrayBuffer'
    )
    return result
  }
  public async convert(ssml, format) {
    // 获取当前时间
    const currentTime = Date.now()
    // 检查是否需要重新获取 s 和 t
    if (!this.serverToken || currentTime - this.lastExecutionTime > 60000) {
      // 重新获取 s 和 t
      this.serverToken = await this.getEndpoint(endpoint)
      console.debug('获取serverToken')
      // 清除之前的定时器（如果有的话）
      if (this.timer !== null) {
        console.debug('清除定时器')
        clearTimeout(this.timer)
        this.timer = null
      }
      // 重新启动定时器，设置为60秒后重新获取 s 和 t
      this.timer = setTimeout(() => {
        this.serverToken = null
        console.debug('60s未接收到转换请求，清除 serverToken')
      }, 60000)
    }
    // 更新最后执行时间
    this.lastExecutionTime = Date.now()
    let result = await this.getAudio(
      Object.values(this.serverToken)[0].toString(),
      Object.values(this.serverToken)[1].toString(),
      ssml,
      format
    )
    return result
  }
}

export const service = new Service()