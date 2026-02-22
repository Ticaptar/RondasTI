import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 20% 15%, rgba(41,212,255,0.28), transparent 45%), linear-gradient(180deg, #090d19, #0b1020)",
          color: "#eef4ff",
          fontSize: 172,
          fontWeight: 700
        }}
      >
        <div
          style={{
            width: 380,
            height: 380,
            borderRadius: 84,
            border: "6px solid rgba(104,180,255,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 18px rgba(41,212,255,0.08)"
          }}
        >
          RF
        </div>
      </div>
    ),
    size
  );
}
