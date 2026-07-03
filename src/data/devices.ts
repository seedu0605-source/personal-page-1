/**
 * 히어로의 얼굴 조형을 구성하는 9개 디지털 기기 데이터.
 *
 * 배치 원칙: 레퍼런스 콜라주처럼 기기들이 서로 "겹치지 않고" 가장자리만 맞닿게
 * (타일/퍼즐처럼) 촘촘히 붙인다. 각 기기는 온전히 다 보인다.
 * 기기 PNG 는 배경·그림자가 제거되어 있어 딱 붙여도 회색 틈이 생기지 않는다.
 * 위치/크기는 이 파일에서만 수정한다. (CSS 에 흩어놓지 않는다.)
 *
 * 좌표계:
 * - x, y : 기기 "중앙" 위치. 얼굴 컨테이너(.face) 기준 백분율(0~100).
 *          x=0 왼쪽/100 오른쪽, y=0 위(이마)/100 아래(턱).
 * - width : 기기 너비. 컨테이너 너비 대비 %. (높이는 이미지 비율로 자동)
 * - rotation : 미세 기울기(deg).
 * - zIndex : 살짝 맞닿는 경계 처리용.
 * - screen : 기기 이미지 안에서 "화면(디스플레이)" 영역의 사각형.
 *            기기 이미지 크기 대비 비율(0~1). sx/sy=좌상단, sw/sh=너비/높이.
 *            여기에 웹캠 영상이 조각으로 담긴다. (없으면 화면 창 미표시)
 */
export interface ScreenRect {
  sx: number
  sy: number
  sw: number
  sh: number
}

export interface Device {
  id: string
  image: string
  alt: string
  x: number
  y: number
  width: number
  rotation: number
  zIndex: number
  screen?: ScreenRect
}

// public/ 자산 경로를 배포 base(예: /personal-page-1/)에 맞춰 붙인다.
// 개발 시 BASE_URL='/', 빌드 시 '/personal-page-1/'.
const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`

export const devices: Device[] = [
  // 이마 — 화이트 아이폰(가로)
  {
    id: 'forehead',
    image: asset('images/devices/phone-wide-white.png'),
    alt: '화이트 아이폰 — 이마',
    x: 35,
    y: 15,
    width: 54,
    rotation: 0,
    zIndex: 1,
    screen: { sx: 0.1, sy: 0.1, sw: 0.75, sh: 0.77 },
  },

  // 오른쪽 관자놀이 — 블랙 미디어 플레이어(가로, 이어버드)
  {
    id: 'temple-right',
    image: asset('images/devices/media-player-black.png'),
    alt: '블랙 미디어 플레이어 — 오른쪽 관자놀이',
    x: 79,
    y: 17,
    width: 34,
    rotation: -3,
    zIndex: 2,
    screen: { sx: 0.11, sy: 0.17, sw: 0.28, sh: 0.5 },
  },

  // 왼쪽 눈 — 노키아(세로)
  {
    id: 'eye-left',
    image: asset('images/devices/phone-nokia.png'),
    alt: '노키아 — 왼쪽 눈',
    x: 14.5,
    y: 37,
    width: 17,
    rotation: 0,
    zIndex: 2,
    screen: { sx: 0.26, sy: 0.21, sw: 0.48, sh: 0.25 },
  },

  // 두 눈 — 블랙 스마트폰(가로)
  {
    id: 'eyes',
    image: asset('images/devices/phone-wide-black.png'),
    alt: '블랙 스마트폰 — 두 눈',
    x: 42,
    y: 35.5,
    width: 38,
    rotation: 0,
    zIndex: 3,
    screen: { sx: 0.13, sy: 0.12, sw: 0.71, sh: 0.76 },
  },

  // 오른쪽 볼 — 파나소닉 무선전화(세로)
  {
    id: 'cheek-right',
    image: asset('images/devices/phone-panasonic.png'),
    alt: '파나소닉 무선전화 — 오른쪽 볼',
    x: 77,
    y: 41,
    width: 20,
    rotation: 0,
    zIndex: 2,
    screen: { sx: 0.27, sy: 0.26, sw: 0.45, sh: 0.14 },
  },

  // 코 — 화이트 삼성 스마트폰(가로)
  {
    id: 'nose',
    image: asset('images/devices/phone-wide-small-white.png'),
    alt: '화이트 삼성 스마트폰 — 코',
    x: 42,
    y: 50.5,
    width: 36,
    rotation: 0,
    zIndex: 3,
    screen: { sx: 0.18, sy: 0.08, sw: 0.6, sh: 0.81 },
  },

  // 왼쪽 볼/턱 — 캐논 디지털 카메라(세로)
  {
    id: 'cheek-left',
    image: asset('images/devices/digital-camera-silver.png'),
    alt: '캐논 디지털 카메라 — 왼쪽 볼',
    x: 16,
    y: 72.5,
    width: 27,
    rotation: 0,
    zIndex: 2,
    screen: { sx: 0.14, sy: 0.08, sw: 0.48, sh: 0.41 },
  },

  // 입 — 핑크 폰(세로)
  {
    id: 'mouth',
    image: asset('images/devices/phone-pink.png'),
    alt: '핑크 폰 — 입',
    x: 41,
    y: 74.5,
    width: 18,
    rotation: 0,
    zIndex: 3,
    screen: { sx: 0.2, sy: 0.08, sw: 0.6, sh: 0.39 },
  },

  // 턱 — 삼성 폴더(세로)
  {
    id: 'chin',
    image: asset('images/devices/phone-flip-black.png'),
    alt: '삼성 폴더 — 턱',
    x: 62.5,
    y: 76.5,
    width: 19,
    rotation: 0,
    zIndex: 2,
    screen: { sx: 0.22, sy: 0.21, sw: 0.56, sh: 0.22 },
  },
]
