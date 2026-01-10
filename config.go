package main

import (
	"encoding/json"
	"io"
	"log"
	"os"
	"path"
)

type Block struct {
	Index int    `json:"index"`
	Id    string `json:"id"`
	Img   string `json:"img"`
	Cmd   string `json:"cmd"`
}

type Config struct {
	Blocks map[string]*Block `json:"blocks"`
}

func LoadConfig() {
	config = &Config{}
	if _, err := os.Stat(configPath); err == nil {
		// config exists
		file, err := os.Open(configPath)
		if err != nil {
			log.Fatalln(err)
		}
		defer file.Close()

		bytes, err := io.ReadAll(file)
		if err != nil {
			log.Fatalln(err)
		}
		err = json.Unmarshal(bytes, config)
		if err != nil {
			log.Fatalln(err)
		}
		log.Printf("Loaded config. Found %d block(s)", len(config.Blocks))
	}
}

func SaveConfig() {
	data, err := json.Marshal(config)
	if err != nil {
		log.Println(err)
		return
	}
	err = os.MkdirAll(path.Dir(configPath), 0755)
	if err != nil {
		log.Println("mkdir failed")
		log.Println(err)
		return
	}
	err = os.WriteFile(configPath, data, 0644)
	if err != nil {
		log.Println("write failed")
		log.Println(err)
		return
	}
}
