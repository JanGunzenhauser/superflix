import path from 'path'
import bodyParser from 'body-parser'
import { createServer } from 'http'
import express from 'express'
import TorrentStreamVLC from 'torrent-stream-vlc'
const PORT = process.env.PORT || 7757

class Server {
  start() {
    const app = express()
    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(express.static(path.join(__dirname, 'dist')))

    app.get('/', (request, response) => {
      response.sendFile(__dirname + '/dist/index.html')
    })
    app.get('/images/:file', (request, response) => {
      response.sendFile(__dirname + '/images/' + request.params.file)
    })
    app.get('/fonts/:file', (request, response) => {
      response.sendFile(__dirname + '/fonts/' + request.params.file)
    })

    const torrentStreamVLC = new TorrentStreamVLC()
    this.server = createServer(app)
    this.io = require('socket.io')(this.server)
    this.io.sockets.on('connection', socket => {
      socket.on('torrent', data => {
        torrentStreamVLC.getFileList(data.torrent).then(choices => {
          socket.emit('files-detected', choices)
        })

        torrentStreamVLC.on('stream-ready', info => {
          socket.emit('stream-ready', info)
        })

        torrentStreamVLC.on('stream-status', status => {
          socket.emit('stream-status', status)
        })

        torrentStreamVLC.on('stream-aborted', () => {
          socket.emit('stream-aborted')
          this.restart();
        })
      })

      socket.on('file-selected', data => {
        torrentStreamVLC.startStream(data.index)
      })

      socket.on('stream-aborting', () => {
        torrentStreamVLC.destroyTorrent()
      })
    })
    this.server.listen(PORT)
  }

  restart() {
    this.server.close()
    this.start()
  }
}

export default Server