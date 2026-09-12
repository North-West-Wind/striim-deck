#!/usr/bin/env sh

rm -r build/
mkdir -p build/

# Transpile client files
echo "Transpiling client files"
cd client
node build.js
zip ../build/client.zip dist/*

cd ..

OSES=("linux" "windows")
ARCHES=("amd64")
export CGO_ENABLED=1

for os in "${OSES[@]}"; do
	for arch in "${ARCHES[@]}"; do
		echo "Compiling for $os $arch"
		export GOOS=$os
		export GOARCH=$arch
		exe_name="striim-deck-$os-$arch"
		if [ "$os" = "windows" ]; then
			exe_name="$exe_name.exe"
			export CC=x86_64-w64-mingw32-gcc
		else
			export CC=gcc
		fi
		go build -ldflags "-w -s" -o "build/$exe_name"
	done
done
