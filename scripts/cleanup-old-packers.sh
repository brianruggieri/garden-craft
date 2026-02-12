#!/bin/bash

# Cleanup script for deprecated packer implementations
# Run this after confirming HierarchicalCirclePacker is working correctly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🧹 GardenCraft Packer Cleanup"
echo "=============================="
echo ""
echo "This script will remove deprecated packer implementations."
echo "Files to remove:"
echo "  - server/packer/CirclePacker.js"
echo "  - server/packer/GardenPacker.js"
echo "  - server/packer/semanticPlanner.js"
echo ""
echo "Files to keep:"
echo "  ✅ server/packer/HierarchicalCirclePacker.js (main algorithm)"
echo "  ✅ server/packer/ForceDirectedGardenPacker.js (wrapper)"
echo "  ✅ server/packer/README.md"
echo "  ✅ server/packer/README_HIERARCHICAL.md"
echo ""

read -p "Continue with cleanup? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

cd "$PROJECT_ROOT"

# Check if files exist before attempting removal
FILES_TO_REMOVE=(
    "server/packer/CirclePacker.js"
    "server/packer/GardenPacker.js"
    "server/packer/semanticPlanner.js"
)

REMOVED_COUNT=0
MISSING_COUNT=0

for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        echo "🗑️  Removing $file"
        rm "$file"
        REMOVED_COUNT=$((REMOVED_COUNT + 1))
    else
        echo "⚠️  Skipping $file (not found)"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
done

echo ""
echo "✅ Cleanup complete!"
echo "   Removed: $REMOVED_COUNT files"
echo "   Missing: $MISSING_COUNT files"
echo ""

# Verify core files still exist
echo "🔍 Verifying core packer files..."
CORE_FILES=(
    "server/packer/HierarchicalCirclePacker.js"
    "server/packer/ForceDirectedGardenPacker.js"
)

ALL_EXIST=true
for file in "${CORE_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file (MISSING!)"
        ALL_EXIST=false
    fi
done

echo ""

if [ "$ALL_EXIST" = true ]; then
    echo "✅ All core files present"
    echo ""
    echo "Next steps:"
    echo "1. Run tests: npm test"
    echo "2. Test pill bounds: node server/tests/test-pill-bounds.js"
    echo "3. Start dev server: npm run dev"
    echo "4. Verify layouts in UI"
else
    echo "❌ ERROR: Core files missing! Restore from git immediately!"
    exit 1
fi
