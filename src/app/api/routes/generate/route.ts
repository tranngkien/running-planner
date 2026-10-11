import { NextResponse } from "next/server";
import { z } from "zod";
import { HTTP_STATUS, isRouteError } from "@/lib/route/errors";
import { generateRoute } from "@/lib/route/generate";
import { getRouteServices } from "@/lib/route/services";

const bodySchema = z.object({
  prompt: z
    .string({ error: "Vui lòng nhập mô tả tuyến chạy" })
    .trim()
    .min(1, "Vui lòng nhập mô tả tuyến chạy")
    .max(500, "Mô tả tối đa 500 ký tự"),
  distanceKm: z
    .number({ error: "Cự ly phải là số" })
    .min(1, "Cự ly phải từ 1 đến 100 km")
    .max(100, "Cự ly phải từ 1 đến 100 km"),
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      {
        code: "INVALID_INPUT",
        error: issue?.path.length ? issue.message : "Dữ liệu không hợp lệ",
        field: issue?.path[0] ?? null,
      },
      { status: 400 },
    );
  }

  try {
    const route = await generateRoute(parsed.data, getRouteServices());
    return NextResponse.json(route);
  } catch (e) {
    if (isRouteError(e)) {
      return NextResponse.json(
        { code: e.code, error: e.message, ...e.details },
        { status: HTTP_STATUS[e.code] },
      );
    }
    console.error("[api/routes/generate] lỗi không mong đợi:", e);
    return NextResponse.json(
      { code: "SERVICE_UNAVAILABLE", error: "Dịch vụ tạm thời không khả dụng, vui lòng thử lại" },
      { status: 503 },
    );
  }
}
