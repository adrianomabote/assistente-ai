{pkgs}: {
  deps = [
    pkgs.dbus
    pkgs.alsa-lib
    pkgs.cairo
    pkgs.pango
    pkgs.gtk3
    pkgs.libdrm
    pkgs.cups
    pkgs.xorg.libXtst
    pkgs.xorg.libXrender
    pkgs.xorg.libXrandr
    pkgs.xorg.libXi
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcursor
    pkgs.xorg.libXcomposite
    pkgs.xorg.libxcb
    pkgs.xorg.libX11
    pkgs.at-spi2-atk
    pkgs.atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
    pkgs.chromium
  ];
}
