#!/usr/bin/env sh

rm -r build/
mkdir -p build/

# Transpile client files
echo "Transpiling client files"
cd client
node build.js

cd ..

OSES=("darwin" "linux" "windows")
ARCHES=("amd64" "arm64")

for os in "${OSES[@]}"; do
	exe_name="striim-deck"
	if [ "$os" = "windows" ]; then
		exe_name="striim-deck.exe"
		CGO_ENABLED=1
	else
		CGO_ENABLED=0
	fi
	for arch in "${ARCHES[@]}"; do
		echo "Compiling for $os $arch"
		GOOS=$os
		GOARCH=$arch
		exe_name="striim-deck-$os-$arch"
		if [ "$os" = "windows" ]; then
			exe_name="$exe_name.exe"
			CGO_ENABLED=1
		else
			CGO_ENABLED=0
		fi
		go build -ldflags "-w -s" -o "build/$exe_name" *.go
	done
done
