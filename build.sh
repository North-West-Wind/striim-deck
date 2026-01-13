#!/usr/bin/env sh

rm -r build/
mkdir -p build/

# Transpile client files
echo "Transpiling client files"
cd client
node build.js

# Move dist to build
cd ..
mkdir build/client
mv client/dist build/client/dist
cd build
zip -r "client.zip" client

OSES=("darwin" "linux" "windows")
ARCHES=("amd64" "arm64")

for os in "${OSES[@]}"; do
	exe_name="striim-deck"
	if [ "$os" = "windows" ]; then
		exe_name="striim-deck.exe"
	fi
	for arch in "${ARCHES[@]}"; do
		echo "Compiling for $os $arch"
		GOOS=$os
		GOARCH=$arch
		mkdir "$os-$arch"
		(
			cd "$os-$arch"
			go build -o "$exe_name" ../../*.go
			exe_file=$(ls | head -n 1)
			cp "../client.zip" "striim-deck-$os-$arch.zip"
			zip -u "striim-deck-$os-$arch.zip" "$exe_file"
			mv "striim-deck-$os-$arch.zip" "../"
		)
	done
done
