import React, { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import api, { formatApiError } from "@/lib/api";
import { toast } from "sonner";

function ScannerCore({ onScan }) {
  useEffect(() => {
    const scanner = new Html5Qrcode("qr-reader-box");
    scanner
      .start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 220, height: 220 } }, onScan, () => {})
      .catch(() => onScan(null));
    return () => {
      try {
        if (scanner.isScanning) {
          scanner.stop().then(() => scanner.clear()).catch(() => {});
        }
      } catch {}
    };
  }, []);
  return <div id="qr-reader-box" data-testid="qr-reader" className="w-full rounded-xl overflow-hidden min-h-[200px] bg-[#F0F5F8]" />;
}

export default function QrScannerDialog({ open, onOpenChange, onSuccess }) {
  const busyRef = useRef(false);

  useEffect(() => {
    if (open) busyRef.current = false;
  }, [open]);

  const handleScan = async (text) => {
    if (text === null) {
      toast.error("تعذّر فتح الكاميرا — تأكدي من السماح بالوصول للكاميرا");
      onOpenChange(false);
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const code = String(text).trim().split("?")[0].split("/").filter(Boolean).pop();
      const { data } = await api.post("/events/checkin", { code });
      if (data.status === "already") {
        toast.info(`حضوركِ مسجل مسبقاً في "${data.title}"`);
      } else {
        toast.success(`تم تسجيل حضوركِ في "${data.title}"`, {
          description: `+${data.points_awarded} نقطة مصباح`,
        });
        onSuccess?.();
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "رمز غير صالح");
      busyRef.current = false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">مسح رمز الفعالية</DialogTitle>
          <DialogDescription>وجّهي الكاميرا نحو رمز QR المعروض في قاعة الفعالية.</DialogDescription>
        </DialogHeader>
        {open && <ScannerCore onScan={handleScan} />}
      </DialogContent>
    </Dialog>
  );
}
