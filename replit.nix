{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    pkgs.nodePackages.typescript
    pkgs.nodePackages.pnpm
    pkgs.libuuid
  ];
}