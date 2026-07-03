import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 프로젝트 사이트는 /<repo>/ 하위에서 서빙되므로
// 빌드 시에만 base 를 저장소 이름으로 둔다. (dev 로컬은 '/' 유지)
// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/personal-page-1/' : '/',
  plugins: [react()],
}))
