import { supabase } from "./supabase";

export type PdfCompressionProfile = "recommended" | "extreme" | "less";

export async function enqueuePdfCompressionJob(
  bucket: "homework" | "materials",
  path: string,
  profile: PdfCompressionProfile = "recommended",
) {
  if (!/\.pdf$/i.test(path)) return null;

  const { data, error } = await supabase.functions.invoke("pdf-compression-jobs", {
    body: { bucket, path, profile },
  });

  if (error) throw error;

  window.dispatchEvent(
    new CustomEvent("lg:pdf-optimization", {
      detail: {
        status: "processing",
        fileName: path.split("/").pop() || "PDF file",
        message: "Uploaded safely. Server-side PDF compression is running…",
        originalSize: null,
        optimizedSize: null,
        savingsBytes: null,
        savingsPercent: null,
      },
    }),
  );

  void trackPdfCompressionJob(String(data?.id || ""), path);
  return data;
}

async function trackPdfCompressionJob(jobId: string, path: string) {
  if (!jobId) return;

  const started = Date.now();
  const timeoutMs = 150_000;

  while (Date.now() - started < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, 2500));

    const { data: job, error } = await supabase
      .from("pdf_compression_jobs")
      .select("status,original_size,final_size,savings_bytes,page_count,error_code,error_message")
      .eq("id", jobId)
      .maybeSingle();

    if (error || !job) continue;
    if (job.status === "queued" || job.status === "processing") continue;

    const originalSize = Number(job.original_size || 0) || null;
    const finalSize = Number(job.final_size || originalSize || 0) || null;
    const savedBytes = Number(job.savings_bytes || 0);
    const savingsPercent =
      originalSize && originalSize > 0
        ? Number(((savedBytes / originalSize) * 100).toFixed(2))
        : 0;

    if (job.status === "optimized") {
      window.dispatchEvent(
        new CustomEvent("lg:pdf-optimization", {
          detail: {
            status: "optimized",
            fileName: path.split("/").pop() || "PDF file",
            originalSize,
            optimizedSize: finalSize,
            savingsBytes: savedBytes,
            savingsPercent,
            message: "Server-side PDF compression completed and the smaller PDF replaced the original safely.",
          },
        }),
      );
    } else if (job.status === "original-kept") {
      window.dispatchEvent(
        new CustomEvent("lg:pdf-optimization", {
          detail: {
            status: "original-kept",
            fileName: path.split("/").pop() || "PDF file",
            originalSize,
            optimizedSize: finalSize,
            savingsBytes: 0,
            savingsPercent: 0,
            validationReason: job.error_message || undefined,
            message: "No safe smaller PDF was produced. The original file was kept.",
          },
        }),
      );
    } else {
      window.dispatchEvent(
        new CustomEvent("lg:pdf-optimization", {
          detail: {
            status: "failed",
            fileName: path.split("/").pop() || "PDF file",
            originalSize,
            optimizedSize: originalSize,
            savingsBytes: 0,
            savingsPercent: 0,
            validationReason: job.error_message || job.error_code || "Unknown compression failure",
            message: "Server-side PDF compression failed safely. The original file was kept.",
          },
        }),
      );
    }
    return;
  }
}
