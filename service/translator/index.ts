import { createHmac, randomUUID } from 'crypto'
import { Buffer } from 'buffer'

export const endpoint = 'https://dev.microsofttranslator.com/apps/endpoint?api-version=1.0'

interface cacheEndpoint {
  serverToken: { r: string; t: string } | null
  unvaildTime: number | null
}

export class Service {
  private cacheEndpoint: cacheEndpoint = {
    serverToken: null,
    unvaildTime: null,
  }
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
          data = Buffer.from(await response.arrayBuffer())
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
    let result
    result = await this.httpPost(
      'https://' + r + '.tts.speech.microsoft.com/cognitiveservices/v1',
      ssml,
      headers,
      'arrayBuffer'
    )
    return result
  }
  public async convert(ssml, format, serverArea?: string) {
    if (Date.now() > this.cacheEndpoint.unvaildTime) {
      this.cacheEndpoint.serverToken = await this.getEndpoint(endpoint)
      console.debug('获取serverToken')
    }
    this.cacheEndpoint.unvaildTime = Date.now() + 3600000
    return this.getAudio(
      serverArea ? serverArea : this.cacheEndpoint.serverToken.r,
      this.cacheEndpoint.serverToken.t,
      ssml,
      format
    )
  }
}

export const service = new Service()
