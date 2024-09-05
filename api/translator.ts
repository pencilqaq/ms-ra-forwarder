import { Request, Response } from 'express'
import { retry } from '../retry'
import { service, FORMAT_CONTENT_TYPE, SERVER_AREA_LIST } from '../service/translator'

module.exports = async (request: Request, response: Response) => {
  console.debug(`请求正文：${request.body}`)
  let token = process.env.TOKEN
  let server = process.env.SERVER
  if (token) {
    let authorization = request.headers['authorization']
    if (authorization != `Bearer ${token}`) {
      console.error('无效的TOKEN')
      response.status(401).json('无效的TOKEN')
      return
    }
  }
  if (SERVER_AREA_LIST.indexOf(server) == -1 && server != '') {  
    console.error('无效的服务器区域')
    response.status(400).json('无效的服务器区域')
    return
  }
  try {
    let ssml = request.body
    if (ssml == null) {
      throw `转换参数无效`
    }
    let format = request.headers['format']
    if (!format) {
      throw '仅支持audio-24khz-48kbitrate-mono-mp3'
    }
    let result = await retry(
      async () => {
        let result = await service.convert(ssml, format as string, server)
        return result
      },
      3,
      (index, error) => {
        console.warn(`第${index}次转换失败：${error}`)
      },
      '服务器多次尝试后转换失败'
    )
    response.sendDate = true
    response
      .status(200)
      .setHeader('Content-Type', FORMAT_CONTENT_TYPE.get(format.toString()))
    response.end(result)
  } catch (error) {
    console.error(`发生错误, ${error.message}`)
    response.status(503).json(error)
  }
}
