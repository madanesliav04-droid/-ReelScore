import {test,expect} from "@playwright/test";

test("Social+ home has two modules and all actions go to the correct workspace",async({page})=>{
  await page.goto("/");
  await expect(page).toHaveTitle(/Social\+/);
  await expect(page.getByRole("heading",{name:/Une meilleure vidéo/})).toBeVisible();
  await expect(page.locator(".social-module")).toHaveCount(2);
  await expect(page.locator(".social-module-edit")).toContainText("Edit+");
  await expect(page.locator(".social-module-viral")).toContainText("Viral+");
  await expect(page.locator("body")).not.toContainText("Clip+");
  await expect(page.locator(".social-hero-buttons a[href='/dashboard?tool=edit']")).toBeVisible();
  await expect(page.locator(".social-hero-buttons a[href='/dashboard?tool=viral']")).toBeVisible();
});

test("Social+ mobile 375px: menu opens and closes, no horizontal overflow",async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto("/");
  await expect(page.getByRole("button",{name:"Ouvrir le menu"})).toBeVisible();
  await expect(page.locator(".social-nav-links")).toBeHidden();
  await page.getByRole("button",{name:"Ouvrir le menu"}).click();
  await expect(page.locator(".social-nav-links")).toBeVisible();
  await page.locator(".social-nav-links a[href='#modules']").click();
  await expect(page.locator(".social-nav-links")).toBeHidden();
  const metrics=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport+1);
  await expect(page.locator(".social-module")).toHaveCount(2);
  await expect(page.getByRole("link",{name:/Commencer avec Edit\+/})).toBeVisible();
});

test("Social+ compact 320px: critical action and install manifest remain reachable",async({page})=>{
  await page.setViewportSize({width:320,height:650});
  await page.goto("/");
  const widths=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:window.innerWidth}));
  expect(widths.scroll).toBeLessThanOrEqual(widths.inner+1);
  const primary=page.getByRole("link",{name:/Commencer avec Edit\+/});
  await expect(primary).toBeVisible();
  await expect(primary).toHaveAttribute("href","/dashboard?tool=edit");
  const response=await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest=await response.json();
  expect(manifest.short_name).toBe("Social+");
  expect(manifest.shortcuts).toHaveLength(2);
  expect(manifest.shortcuts.map((x:{name:string})=>x.name)).toEqual(["Edit+","Viral+"]);
  for(const uri of ["/icon.svg","/icon-192.png","/icon-512.png","/apple-icon.png"]){
    const icon=await page.request.get(uri);
    expect(icon.status()).toBe(200);
  }
});

test("Social+ public landing has no made-up performance metrics",async({page})=>{
  await page.goto("/");
  await expect(page.getByText("Pas de chiffres inventés")).toBeVisible();
  await expect(page.getByText("Des diagnostics argumentés, jamais de viralité garantie.")).toBeVisible();
});
