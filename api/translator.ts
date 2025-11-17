import { Request, Response } from 'express'
import { retry } from '../retry'
import { service } from '../service/translator'
import { FORMAT_CONTENT_TYPE, SERVER_AREA } from './src/constants'

module.exports = async (request: Request, response: Response) => {
  console.debug(`请求正文：${request.body}`)
  let token = process.env.TOKEN
  let server = process.env.SERVER
  let validEnvServer = true
  if (token) {
    let authorization = request.headers['authorization']
    if (authorization != `Bearer ${token}`) {
      console.error('无效的TOKEN')
      response.status(401).json('无效的TOKEN')
      return
    }
  }
  if (!(server && SERVER_AREA.has(server))) {
    console.warn('未指定SERVER或指定了无效的SERVER')
    validEnvServer = false
  }
  try {
    let ssml = request.body
    if (ssml == null) {
      throw `转换参数无效`
    }
    let format = request.headers['format']
    if (FORMAT_CONTENT_TYPE.get(format.toString()) == null) {
      throw '音频格式无效'
    }
    let result = await retry(
      async () => {
        if (validEnvServer) {
          return service.convert(ssml, format as string, server)
        } else {
          return service.convert(ssml, format as string)
        }
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
