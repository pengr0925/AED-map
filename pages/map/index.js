import QQMapWX from '../../libs/qqmap-wx-jssdk.min.js'
const qqmapsdk = new QQMapWX({ key: 'I5NBZ-UM2WT-BAWXF-LZIZ5-HFWK3-7ZBJC' })

const MOCK_AEDS = [
  { id: 1, name: '图书馆一层大厅', latitude: 34.23012, longitude: 108.91110, address: '图书馆东门旁' },
  { id: 2, name: '体育中心服务台', latitude: 34.22458, longitude: 108.91190, address: '主场馆入口' },
  // { id: 3, name: '一号教学楼 1F', latitude: 34.22645, longitude: 108.90732, address: '南侧门口' }
  { id: 3, name: '一号教学楼 1F', latitude: 34.13550, longitude: 108.87500, address: '南侧门口' }
]

Page({
  data: {
    searchText: '请输入位置信息',
    scale: 15,
    center: { latitude: 34.226, longitude: 108.910 }, // 默认中心
    myLocation: null,
    markers: []
  },

  onLoad() {
    this.bootstrap() // 打开就定位
  },

  onReady() {
    // MapContext 需要在界面渲染后创建
    this.mapCtx = wx.createMapContext('map')
  },

  // 点击“回到我的位置”
  onLocateTap(){
    // 已有定位则直接移动相机；没有则先取一次定位
    if (this.data.myLocation) {
      const { latitude, longitude } = this.data.myLocation
      this.setData({ center:{ latitude, longitude }, scale: 16 })
      this.mapCtx.moveToLocation({ latitude, longitude })
      return
    }
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      success: ({ latitude, longitude }) => {
        this.setData({ myLocation:{ latitude, longitude }, center:{ latitude, longitude } })
        this.mapCtx.moveToLocation({ latitude, longitude })
      },
      fail: () => wx.showToast({ title: '需要定位权限', icon: 'none' })
    })
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch(e) {
    const address = (e.detail.value || this.data.keyword || '').trim()
    if (!address) return
    qqmapsdk.geocoder({
      address,
      success: (res) => {
        const { lat, lng } = res.result.location
        this.setData({ center: { latitude: lat, longitude: lng }, scale: 16 }, () => {
          this.mapCtx && this.mapCtx.moveToLocation({ latitude: lat, longitude: lng })
        })
      },
      fail: () => wx.showToast({ title: '地址解析失败', icon: 'none' })
    })
  },

  async bootstrap() {
    try {
      const loc = await this.getLocation() // { latitude, longitude }
      this.setData({ myLocation: loc, center: loc, scale: 16 }, () => {
        // 1) 把地图摄像机移到当前位置
        this.mapCtx && this.mapCtx.moveToLocation({
          latitude: loc.latitude, longitude: loc.longitude
        })
        // 2) 或者把“我 + AED 点”一起纳入视野（更直观）
        const points = [loc, ...MOCK_AEDS].map(p => ({ latitude: p.latitude, longitude: p.longitude }))
        this.mapCtx && this.mapCtx.includePoints({ points, padding: [60, 60, 60, 60] })
      })
    } catch (e) {
      console.warn('定位失败：', e)
      wx.showToast({ title: '请开启定位权限', icon: 'none' })
    }
    this.refreshMarkers()
  },

  getLocation() {
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        highAccuracyExpireTime: 5000,
        success: ({ latitude, longitude }) => resolve({ latitude, longitude }),
        fail: reject
      })
    })
  },

  refreshMarkers() {
    const { myLocation } = this.data
    const markers = MOCK_AEDS.map((p) => {
      const d = myLocation ? this.distanceMeters(myLocation, p).toFixed(0) : null
      return {
        id: p.id,
        latitude: p.latitude,
        longitude: p.longitude,
        iconPath: '/assets/aed-blue.png', // 确保文件存在；否则去掉用默认圆点
        width: 32, height: 32,
        callout: {
          content: `${p.name}${d ? `\n距我约 ${d} 米` : ''}`,
          color: '#111', fontSize: 12, borderRadius: 6, bgColor: '#ffffff',
          padding: 6, display: 'BYCLICK'
        },
        customData: p
      }
    })

    // 可选：把“我的位置”也做成一个 marker
    if (myLocation) {
      markers.push({
        id: 99999,
        latitude: myLocation.latitude,
        longitude: myLocation.longitude,
        width: 20, height: 27,
        // iconPath: '/assets/aed.png',
        callout: { content: '我的位置', display: 'BYCLICK', padding: 6, borderRadius: 6 }
      })
    }

    this.setData({ markers })
  },

  distanceMeters(a, b) {
    const toRad = deg => (deg * Math.PI) / 180
    const R = 6378137
    const dLat = toRad(b.latitude - a.latitude)
    const dLng = toRad(b.longitude - a.longitude)
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(s))
  },

  choosePlace() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          searchText: res.name || '已选择位置',
          center: { latitude: res.latitude, longitude: res.longitude },
          scale: 16
        }, () => {
          this.mapCtx && this.mapCtx.moveToLocation({ latitude: res.latitude, longitude: res.longitude })
        })
      }
    })
  },

  async locateMe() {
    try {
      const loc = await this.getLocation()
      this.setData({ myLocation: loc })
      const nearest = [...MOCK_AEDS].sort((a, b) =>
        this.distanceMeters(loc, a) - this.distanceMeters(loc, b)
      )[0]
      const target = nearest ? { latitude: nearest.latitude, longitude: nearest.longitude } : loc
      this.setData({ center: target, scale: 16 }, () => {
        this.refreshMarkers()
        this.mapCtx && this.mapCtx.moveToLocation(target)
      })
      nearest && wx.showToast({ title: `最近：${nearest.name}`, icon: 'none' })
    } catch (e) {
      wx.showToast({ title: '请开启定位权限', icon: 'none' })
    }
  },

  onMarkerTap(e) {
    // 注意：bindmarkertap 的 id 在 e.detail.markerId
    const id = e.detail && e.detail.markerId
    const m = this.data.markers.find(x => x.id === id)
    if (m) this.mapCtx && this.mapCtx.showCallout({ markerId: id })
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/add/index' })
  }
})



// Page({
//   data: {
//     searchText: '请输入位置信息',
//     scale: 15,
//     center: { latitude: 34.226, longitude: 108.910 },// 默认中心
//     myLocation: null,
//     markers: []
//   },

//   onLoad() {
//     this.mapCtx = wx.createMapContext('map')
//     this.bootstrap()
//   },

//   onInput(e) {
//     this.setData({ keyword: e.detail.value })
//   },

//   onSearch(e) {
//     const address = (e.detail.value || this.data.keyword || '').trim()
//     if (!address) return
//     qqmapsdk.geocoder({
//       address,
//       success: (res) => {
//         const { lat, lng } = res.result.location
//         this.setData({ center: { latitude: lat, longitude: lng } })
//         this.mapCtx.moveToLocation({ latitude: lat, longitude: lng })
//       },
//       fail: () => wx.showToast({ title: '地址解析失败', icon: 'none' })
//     })
//   },

//   async bootstrap() {
//     try {
//       const loc = await this.getLocation()
//       this.setData({ myLocation: loc, center: loc })
//     } catch (e) {
//       console.warn('定位失败：', e)
//     }
//     this.refreshMarkers()
//   },

//   getLocation() {
//     return new Promise((resolve, reject) => {
//       wx.getLocation({
//         type: 'gcj02',
//         success: (res) => resolve({ latitude: res.latitude, longitude: res.longitude }),
//         fail: reject
//       })
//     })
//   },

//   refreshMarkers() {
//     const { myLocation } = this.data
//     const markers = MOCK_AEDS.map((p) => {
//       const d = myLocation ? this.distanceMeters(myLocation, p).toFixed(0) : null
//       return {
//         id: p.id,
//         latitude: p.latitude,
//         longitude: p.longitude,
//         iconPath: '/assets/aed.png',
//         width: 32, height: 32,
//         callout: {
//           content: `${p.name}${d ? `\n距我约 ${d} 米` : ''}`,
//           color: '#111', fontSize: 12, borderRadius: 6, bgColor: '#ffffff',
//           padding: 6, display: 'BYCLICK'
//         },
//         customData: p
//       }
//     })
//     this.setData({ markers })
//   },

//   distanceMeters(a, b) {
//     const toRad = deg => (deg * Math.PI) / 180
//     const R = 6378137
//     const dLat = toRad(b.latitude - a.latitude)
//     const dLng = toRad(b.longitude - a.longitude)
//     const s =
//       Math.sin(dLat / 2) ** 2 +
//       Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
//     return 2 * R * Math.asin(Math.sqrt(s))
//   },

//   choosePlace() {
//     wx.chooseLocation({
//       success: (res) => {
//         this.setData({
//           searchText: res.name || '已选择位置',
//           center: { latitude: res.latitude, longitude: res.longitude }
//         })
//         this.mapCtx.moveToLocation({ latitude: res.latitude, longitude: res.longitude })
//       }
//     })
//   },

//   async locateMe() {
//     try {
//       const loc = await this.getLocation()
//       this.setData({ myLocation: loc })
//       const sorted = [...MOCK_AEDS].sort((a, b) => this.distanceMeters(loc, a) - this.distanceMeters(loc, b))
//       const nearest = sorted[0]
//       if (nearest) {
//         this.setData({ center: { latitude: nearest.latitude, longitude: nearest.longitude } })
//         this.refreshMarkers()
//         this.mapCtx.moveToLocation({ latitude: nearest.latitude, longitude: nearest.longitude })
//         wx.showToast({ title: `最近：${nearest.name}`, icon: 'none' })
//       }
//     } catch (e) {
//       wx.showToast({ title: '请开启定位权限', icon: 'none' })
//     }
//   },

//   onMarkerTap(e) {
//     const id = e.markerId
//     const m = this.data.markers.find(x => x.id === id)
//     if (m) {
//       this.mapCtx.showCallout({ markerId: id })
//     }
//   },

//   goAdd() {
//     wx.navigateTo({ url: '/pages/add/index' })
//   }
// })