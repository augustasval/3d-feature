#!/bin/bash
# TripoSR 3D Panel Installer for macOS

set -e

echo "=========================================="
echo "  TripoSR 3D Panel Installer"
echo "=========================================="
echo ""

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PANEL_NAME="TripoSR-3D-Panel"
DEST_DIR="$HOME/Library/Application Support/Adobe/CEP/extensions/$PANEL_NAME"

# Step 1: Enable CEP Debug Mode (all versions)
echo "[1/3] Enabling CEP debug mode..."
for version in 9 10 11 12; do
    defaults write com.adobe.CSXS.$version PlayerDebugMode 1 2>/dev/null || true
done
echo "      Done"

# Step 2: Create extensions directory
echo "[2/3] Installing panel files..."
mkdir -p "$HOME/Library/Application Support/Adobe/CEP/extensions"

# Step 3: Copy panel files
if [ -d "$DEST_DIR" ]; then
    echo "      Removing previous installation..."
    rm -rf "$DEST_DIR"
fi

cp -R "$SCRIPT_DIR" "$DEST_DIR"
echo "      Panel installed to: $DEST_DIR"

# Success
echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Restart After Effects"
echo "  2. Go to Window > Extensions > TripoSR 3D"
echo "  3. Enter your RunPod API key and endpoint ID"
echo ""
echo "Press any key to close..."
read -n 1
