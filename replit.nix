{ pkgs }: {
  deps = [
    pkgs.lsof
    pkgs.nodejs_22
    pkgs.nodePackages.typescript
    pkgs.nodePackages.pnpm
    pkgs.libuuid
  ];
}