# 랜덤 자리 배치 배포용 프로젝트

## 실행 방법

```bash
npm install
npm run dev
```

## 배포 방법

GitHub에 이 폴더 전체를 업로드한 뒤 Vercel에서 Import Project로 연결하면 됩니다.

## 관리자 비밀번호 변경

`src/App.jsx` 상단의 아래 값을 수정하세요.

```js
const APP_CONFIG = {
  ADMIN_PASSWORD: "admin1234",
};
```
