import {defineConfig} from '@playwright/test';
const webkit=process.env.PLAYWRIGHT_BROWSER==='webkit';
export default defineConfig({testDir:'./tests',timeout:30000,use:{browserName:webkit?'webkit':'chromium',baseURL:'http://127.0.0.1:3100',launchOptions:{...(!webkit&&process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})}},webServer:{command:'npm run dev -- --hostname 127.0.0.1 --port 3100',url:'http://127.0.0.1:3100',reuseExistingServer:!process.env.CI},workers:1});
