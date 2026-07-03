import type { CSSProperties, Ref } from 'react'
import type { Device } from '../../data/devices'
import styles from './DeviceFrame.module.css'

interface DeviceFrameProps {
  device: Device
  /** Hero 가 스크롤 낙하 트랜스폼을 직접 주입할 수 있도록 프레임 DOM 을 노출 */
  frameRef?: Ref<HTMLDivElement>
  /** Hero 가 웹캠 조각의 크기/오프셋을 주입할 화면 영상 요소 */
  videoRef?: (el: HTMLVideoElement | null) => void
  /** 웹캠 스트림이 준비됐을 때만 화면 창(영상)을 표시 */
  showScreen?: boolean
}

/**
 * 개별 디지털 기기 한 대.
 * 위치/크기/회전은 devices.ts 데이터에서 주입. transform 은 Hero 가 명령형으로 덮어씀.
 * device.screen 이 있고 웹캠이 준비되면, 화면 영역에 웹캠 '조각' 영상을 얹는다.
 */
export default function DeviceFrame({
  device,
  frameRef,
  videoRef,
  showScreen,
}: DeviceFrameProps) {
  const style: CSSProperties = {
    left: `${device.x}%`,
    top: `${device.y}%`,
    width: `${device.width}%`,
    transform: `translate(-50%, -50%) rotate(${device.rotation}deg)`,
    zIndex: device.zIndex,
  }

  const s = device.screen

  return (
    <div ref={frameRef} className={styles.frame} style={style}>
      <img className={styles.image} src={device.image} alt={device.alt} />

      {showScreen && s && (
        <div
          className={styles.screen}
          style={{
            left: `${s.sx * 100}%`,
            top: `${s.sy * 100}%`,
            width: `${s.sw * 100}%`,
            height: `${s.sh * 100}%`,
          }}
        >
          {/* width/height/left/top 은 Hero 가 주입해 얼굴 조각을 정렬한다 */}
          <video
            ref={videoRef}
            className={styles.video}
            autoPlay
            muted
            playsInline
          />
        </div>
      )}
    </div>
  )
}
