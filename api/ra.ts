import { Request, Response } from 'express'
import { retry } from '../retry'
import { service, FORMAT_CONTENT_TYPE } from '../service/edge'
import { service as translator, SERVER_AREA_LIST } from '../service/translator'

module.exports = async (request: Request, response: Response) => {
  console.debug(`请求正文：${request.body}`)
  let server = process.env.SERVER
  let activeEnvServer: boolean = true
  if (server === undefined || !SERVER_AREA_LIST.has(server)) {
    activeEnvServer = false
  }

  let token = process.env.TOKEN
  if (token) {
    let authorization = request.headers['authorization']
    if (authorization != `Bearer ${token}`) {
      console.error('无效的TOKEN')
      response.status(401).json('无效的TOKEN')
      return
    }
  }

  try {
    let format = request.headers['format'] || 'audio-24khz-48kbitrate-mono-mp3'
    if (Array.isArray(format)) {
      throw `无效的音频格式：${format}`
    }
    if (!FORMAT_CONTENT_TYPE.has(format)) {
      throw `无效的音频格式：${format}`
    }

    let ssml = request.body
    if (ssml == null) {
      throw `转换参数无效`
    }
    let result = await retry(
      async () => {
        let originalUrl = request.originalUrl
        console.log('originalUrl:' + originalUrl)
        console.log('request.url' + request.url + '\n' + 'request.path' + request.path)

        switch (originalUrl) {
          case '/api/translator':
            return await translator.convert(
              ssml,
              format as string,
              activeEnvServer ? server : undefined
            )
          case '/api/ra':
            return await service.convert(ssml, format as string)
          default:
            throw `url错误：${originalUrl}`
        }
      },
      3,
      (index, error) => {
        console.warn(`第${index}次转换失败：${error}`)
      },
      '服务器多次尝试后转换失败'
    )
    response.sendDate = true
    response.status(200).setHeader('Content-Type', FORMAT_CONTENT_TYPE.get(format))
    response.end(result)
  } catch (error) {
    console.error(`发生错误, ${error.message}`)
    response.status(503).json(error)
  }
}
