import { expect, test, type Page } from "@playwright/test";
import { E2E_PASSWORD, E2E_USER } from "../../playwright.config";

async function login(page: Page, password = E2E_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(E2E_USER);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

async function generate(page: Page, prompt: string, distance: string) {
  await page.getByLabel("Mô tả tuyến chạy").fill(prompt);
  const preset = page.getByRole("radio", { name: `${distance} km`, exact: true });
  if (await preset.count()) {
    await preset.check();
  } else {
    await page.getByRole("radio", { name: "Khác" }).check();
    await page.getByLabel("Cự ly tự chọn (km)").fill(distance);
  }
  await page.getByRole("button", { name: "Tạo map" }).click();
}

test.describe("Đăng nhập", () => {
  test("AC1: chưa đăng nhập → bị chuyển về /login, API trả 401", async ({ page, request }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    const res = await request.post("/api/routes/generate", { data: { prompt: "Times City", distanceKm: 10 } });
    expect(res.status()).toBe(401);
  });

  test("AC2: sai mật khẩu báo lỗi, đúng thì vào trang chính", async ({ page }) => {
    await login(page, "sai-mat-khau");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Sai tên đăng nhập hoặc mật khẩu");
    await expect(page).toHaveURL(/\/login$/);

    await login(page);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByLabel("Mô tả tuyến chạy")).toBeVisible();
  });

  test("AC3: đăng xuất → quay về /login và không vào lại được", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("button", { name: "Đăng xuất" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Tạo map", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/$/);
  });

  test("AC4: Times City qua cầu Long Biên, 21 km → tuyến vòng trong ±3%", async ({ page }) => {
    await generate(page, "Tôi muốn tạo 1 map chạy xuất phát từ Cổng Times City và đi qua cầu Long Biên", "21");
    const distance = page.getByTestId("route-distance");
    await expect(distance).toBeVisible();
    const km = Number(await distance.getAttribute("data-km"));
    expect(km).toBeGreaterThanOrEqual(20.37);
    expect(km).toBeLessThanOrEqual(21.63);

    const points = page.getByTestId("route-points").getByRole("listitem");
    await expect(points.first()).toContainText("Times City");
    await expect(page.getByTestId("route-points")).toContainText("Cầu Long Biên");
    // Bản đồ Leaflet (OpenStreetMap) hiển thị và đã vẽ đường chạy
    const map = page.getByTestId("route-map");
    await expect(map).toBeVisible();
    await expect(map.locator("path.leaflet-interactive").first()).toBeVisible();
    await expect(map).toContainText("OpenStreetMap");
  });

  test("AC5: cự ly quá ngắn → báo không thể tạo map", async ({ page }) => {
    await generate(page, "Xuất phát từ Times City, đi qua Hồ Tây", "3");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Cự ly và mô tả không thể tạo được Map chạy hợp lệ");
  });

  test("AC6: không có điểm xuất phát", async ({ page }) => {
    await generate(page, "tôi muốn chạy bộ", "10");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Không xác định được điểm xuất phát từ mô tả");
  });

  test("AC7: địa điểm không tồn tại", async ({ page }) => {
    await generate(page, "Xuất phát từ Times City, đi qua Atlantis", "10");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Không tìm thấy địa điểm: Atlantis");
  });

  test("AC8: dịch vụ ngoài lỗi", async ({ page }) => {
    await generate(page, "Times City [giả lập lỗi dịch vụ]", "10");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Dịch vụ tạm thời không khả dụng, vui lòng thử lại");
  });

  test("AC9: mô tả rỗng và cự ly ngoài 1–100 báo lỗi tại ô nhập", async ({ page }) => {
    await page.getByRole("button", { name: "Tạo map" }).click();
    await expect(page.getByText("Vui lòng nhập mô tả tuyến chạy")).toBeVisible();
    await expect(page.getByLabel("Mô tả tuyến chạy")).toHaveAttribute("aria-invalid", "true");

    await generate(page, "Times City", "101");
    await expect(page.getByText("Cự ly phải từ 1 đến 100 km")).toBeVisible();
    await expect(page.getByLabel("Cự ly tự chọn (km)")).toHaveAttribute("aria-invalid", "true");
  });
});
