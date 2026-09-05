# Normalise the hotel-brand logos used by the login rail.
#
#  * decode any PNG flavour (palette / 4-bit / RGBA) via System.Drawing
#  * downscale to a sane size (some sources are 3840x2160 for a 36px slot)
#  * give every logo a real alpha channel:
#      - images that are fully opaque were exported "ink on white", so the white
#        is un-composited back out (alpha = 255 - min(r,g,b)), which keeps the
#        anti-aliased edges clean instead of leaving a grey halo
#      - images that already have alpha only get their near-white INK knocked
#        out (e.g. the white "BW" inside Best Western's blue disc) so it stays a
#        knockout once the rail renders the logo as a silhouette
#  * trim to the artwork's bounding box so every logo fills its cell evenly
#
# Originals are left untouched; results go to marqueeImages\mono\.

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$code = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public static class LogoNorm
{
    public static string Process(string src, string dst, int maxDim)
    {
        using (Bitmap orig = new Bitmap(src))
        {
            int w = orig.Width, h = orig.Height;
            double scale = Math.Min(1.0, (double)maxDim / Math.Max(w, h));
            int nw = Math.Max(1, (int)Math.Round(w * scale));
            int nh = Math.Max(1, (int)Math.Round(h * scale));

            using (Bitmap bmp = new Bitmap(nw, nh, PixelFormat.Format32bppArgb))
            {
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    g.Clear(Color.Transparent);
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.DrawImage(orig, new Rectangle(0, 0, nw, nh));
                }

                Rectangle rect = new Rectangle(0, 0, nw, nh);
                BitmapData bd = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
                int stride = bd.Stride;
                byte[] buf = new byte[stride * nh];
                Marshal.Copy(bd.Scan0, buf, 0, buf.Length);

                // Pass 1 - how opaque is this image overall?
                long opaque = 0;
                long total = (long)nw * nh;
                for (int y = 0; y < nh; y++)
                {
                    int row = y * stride;
                    for (int x = 0; x < nw; x++)
                        if (buf[row + x * 4 + 3] > 200) opaque++;
                }
                bool onWhite = opaque >= total * 99 / 100;

                // Pass 2 - build the alpha channel.
                int maxAlpha = 1;
                if (onWhite)
                {
                    for (int y = 0; y < nh; y++)
                    {
                        int row = y * stride;
                        for (int x = 0; x < nw; x++)
                        {
                            int i = row + x * 4;
                            int b = buf[i], gg = buf[i + 1], r = buf[i + 2];
                            int a = 255 - Math.Min(r, Math.Min(gg, b));
                            if (a > maxAlpha) maxAlpha = a;
                        }
                    }
                    for (int y = 0; y < nh; y++)
                    {
                        int row = y * stride;
                        for (int x = 0; x < nw; x++)
                        {
                            int i = row + x * 4;
                            int b = buf[i], gg = buf[i + 1], r = buf[i + 2];
                            int a = 255 - Math.Min(r, Math.Min(gg, b));
                            if (a == 0) { buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0; continue; }
                            int k = 255 - a;
                            buf[i]     = Clamp((b - k) * 255 / a);
                            buf[i + 1] = Clamp((gg - k) * 255 / a);
                            buf[i + 2] = Clamp((r - k) * 255 / a);
                            // Stretch so the densest ink reaches full opacity, keeping
                            // this logo as solid as the ones that already had alpha.
                            buf[i + 3] = Clamp(a * 255 / maxAlpha);
                        }
                    }
                }
                else
                {
                    for (int y = 0; y < nh; y++)
                    {
                        int row = y * stride;
                        for (int x = 0; x < nw; x++)
                        {
                            int i = row + x * 4;
                            if (buf[i + 3] < 250) continue;
                            if (buf[i] >= 242 && buf[i + 1] >= 242 && buf[i + 2] >= 242)
                            { buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0; }
                        }
                    }
                }

                // Pass 3 - alpha bounding box.
                int minX = nw, minY = nh, maxX = -1, maxY = -1;
                for (int y = 0; y < nh; y++)
                {
                    int row = y * stride;
                    for (int x = 0; x < nw; x++)
                    {
                        if (buf[row + x * 4 + 3] <= 8) continue;
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }

                Marshal.Copy(buf, 0, bd.Scan0, buf.Length);
                bmp.UnlockBits(bd);

                if (maxX < minX || maxY < minY) { minX = 0; minY = 0; maxX = nw - 1; maxY = nh - 1; }
                Rectangle crop = new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);

                using (Bitmap outBmp = bmp.Clone(crop, PixelFormat.Format32bppArgb))
                {
                    outBmp.Save(dst, ImageFormat.Png);
                    return string.Format("{0}x{1} -> {2}x{3}  ({4})",
                        w, h, outBmp.Width, outBmp.Height, onWhite ? "un-composited off white" : "white ink knocked out");
                }
            }
        }
    }

    static byte Clamp(int v) { return (byte)(v < 0 ? 0 : (v > 255 ? 255 : v)); }
}
"@

Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$dir = "D:\react hbs\react-22-06-26\react_hbs-hbs-ibyta-react-02-06-26\public\images\marqueeImages"
$out = Join-Path $dir "mono"
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }

$files = @(
  "Marriott-logo.png", "Hilton-logo.png", "Hyatt-Logo.png", "Sheraton-logo.png",
  "Four-Seasons-Logo.png", "IHG-Logo.png", "Crowne-Plaza-logo.png",
  "Holiday-Inn-logo.png", "Accor-logo.png", "Movenpick-Logo.png",
  "jumeirah-logo-png_seeklogo.png", "Atlantis.png", "Taj.png", "Best-Western-logo.png"
)

foreach ($f in $files) {
  $s = Join-Path $dir $f
  $d = Join-Path $out $f
  $info = [LogoNorm]::Process($s, $d, 320)
  $kb = [int]((Get-Item $d).Length / 1KB)
  Write-Output ("{0,-34} {1}  [{2} KB]" -f $f, $info, $kb)
}
