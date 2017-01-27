import React, { Component } from 'react'
const socket = require('socket.io-client')('http://localhost:7757')
const fileExtensionRE = /(?:\.([^.]+))?$/
const videoFileExtenstions = [ "3g2", "3gp", "aaf", "asf", "avchd", "avi", "drc", "flv", "m2v", "m4p", "m4v", "mkv", "mng", "mov", "mp2", "mp4", "mpe", "mpeg", "mpg", "mpv", "mxf", "nsv", "ogg", "ogv", "qt", "rm", "rmvb", "roq", "svi", "vob", "webm", "wmv", "yuv" ]

class FlixCapacitor extends Component {
  constructor(props) {
    super(props)
    const defaultState = {
      flixStatus: 'detecting',
      dragOver: false,
      error: false,
      loading: false,
      loadMessage: '',
      detectedFiles: [],
      fileSize: '',
      streamTitle: '',
      streamPath: '',
      streamStatus: {
        downloadedPercentage: 0,
        downloadSpeed: '',
        uploadSpeed: '',
        downloadedSize: '',
        uploadedSize: '',
        peersActive: 0,
        peersAvailable: 0
      }
    }
    this.state = defaultState

    socket.on('connect', () => {
      socket.on('stream-ready', info => {
        this.setState({ 
          streamPath: info.href,
          loading: false,
          loadMessage: '',
          flixStatus: 'streaming'
        })
      })
      socket.on('stream-status', streamStatus => {
        if (streamStatus.downloadedPercentage > 100) streamStatus.downloadedPercentage = 100
        this.setState({ 
          streamStatus
        })
      })
      socket.on('stream-aborted', () => {
        this.resetState()
      })
      socket.on('files-detected', choices => {
        this.setState({
          loading: false,
          loadMessage: '',
          detectedFiles: choices,
          flixStatus: 'selecting'
        })
      })
    }) 
  }

  resetState() {
    this.setState({
      loading: false,
      loadMessage: '',
      flixStatus: 'detecting',
      detectedFiles: [],
      streamTitle: '',
      fileSize: '',
      streamStatus: {
        downloadedPercentage: 0,
        downloadSpeed: '',
        uploadSpeed: '',
        downloadedSize: '',
        uploadedSize: '',
        peersActive: 0,
        peersAvailable: 0
      }
    })
  }

  revertApp() {
    this.resetState()
    socket.emit('stream-aborting')
  }

  drop(e) {
    e.preventDefault();
    let target
    if (e.dataTransfer) { 
      let dt = e.dataTransfer
      if (dt.files && dt.files.length) {
        target = dt.files[0]
      } else {
        target = dt.getData('text')
      }
    }

    if (target) {
      this.detectTorrent(target).then(torrent => {
        socket.emit('torrent', {torrent})
        this.setState({
          loading: true,
          loadMessage: 'Checking torrent for video files'
        })
      }).catch(err => {
        console.log('not detected')
        this.setState({
          error: true,
          loading: true,
          loadMessage: 'No torrent detected, try again'
        })
        setTimeout(() => {
          this.setState({
            error: false,
            detectedFiles: [],
            streamTitle: '',
            loading: false,
            loadMessage: ''
          })
        }, 2000)
      })
    }
  }

  dragOver(e) {
    e.preventDefault()
    this.setState({
      dragOver: true
    })
  }

  dragLeave(e) {
    e.preventDefault();
    this.setState({
      dragOver: false
    })
  }

  detectTorrent(target) {
    return new Promise((resolve, reject) => {
      if (target.type == "application/x-bittorrent" || target.indexOf('magnet:?') > -1) {
        resolve(target)
      } else {
        reject('Torrent not detected')
      }
    })
  }

  fileSelected(file) {
    this.setState({
      streamTitle: file.name,
      loading: true,
      fileSize: file.size,
      loadMessage: 'Starting stream & launching VLC'
    })
    socket.emit('file-selected', {index: file.value})
  }

  renderStreamStatus() {
    return <div className="stream-status">
      <div className="status-title">Streaming to VLC <span>({this.state.streamPath})</span></div>
      <div className="stream-title">{this.state.streamTitle}</div>
      <div className="progress-count">{this.state.streamStatus.downloadedPercentage}<span>%</span></div>
      <div className="progress-bar-container">
         <div className="progress-bar" style={{width: this.state.streamStatus.downloadedPercentage + '%'}}></div>
      </div>
      <div className="network-throughput">
        <div className="traffic download">
          <span className="fa fa-download"></span>
          {this.state.streamStatus.downloadSpeed}</div>
        <div className="traffic upload">
          <span className="fa fa-upload"></span>
          {this.state.streamStatus.uploadSpeed}</div>
      </div>
      <div className="peers">
        Peers <span>{this.state.streamStatus.peersActive}</span> / <span>{this.state.streamStatus.peersAvailable}</span>
      </div>
      <div className="download-info">
        <p>Downloaded <span>{this.state.streamStatus.downloadedSize}</span> / <span>{this.state.fileSize}</span>  | Uploaded <span>{this.state.streamStatus.uploadedSize}</span>.</p><p>Data is temporarily stored in <i>/tmp/torrent-stream/</i></p>
      </div>
    </div>
  }

  renderTorrentDetector() {
    return <div className="detection-zone">
      <div className={'drop-zone drag-over-' + this.state.dragOver} onDragOver={this.dragOver.bind(this)} onDragLeave={this.dragLeave.bind(this)} onDrop={this.drop.bind(this)}></div>
      <div className="drop-zone-overlay"></div>
      <div className={'drop-notice drag-over-' + this.state.dragOver}>
        <div className="fa fa-file"></div>
        <label>Drop a magnet link or torrent file</label>
      </div>
    </div>
  }

  renderFileList() {
    let list = this.state.detectedFiles.map(file => {
      const fileExtenstion = fileExtensionRE.exec(file.name)[1]
      if (videoFileExtenstions.indexOf(fileExtenstion) > -1) {
        return <li key={file.value} onClick={this.fileSelected.bind(this, file)}>
          <div className="title">{file.name}</div>
          <div className="label">{file.size}</div>
          <div className="button"><div className="fa fa-play"></div></div>
        </li>
      }
    })
    return <div className="file-list">
      <label>Select file to stream</label>
      <ul>{list}</ul>
    </div>
  }

  render() {
    let activeView 
    let exitButton = <div onClick={this.revertApp.bind(this)} className="exit-button"><span className="fa fa-close"></span></div>
    switch (this.state.flixStatus) {
      case 'detecting': 
        activeView = this.renderTorrentDetector()
        exitButton = ''
        break
      case 'selecting': 
        activeView = this.renderFileList()
        break
      case 'streaming':
        activeView = this.renderStreamStatus()
        break
    }

    return <div className={'view view-' + this.state.flixStatus + ' loading-' + this.state.loading}>{exitButton}{activeView}
        <div className={'loader error-' + this.state.error}>
          <div className="fa fa-cog"></div>
          <div className="fa fa-exclamation-circle"></div>
          <div className="label"><p>{this.state.loadMessage}</p></div>
        </div>
      </div>
  }
}

export default FlixCapacitor