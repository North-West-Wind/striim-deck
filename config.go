package main

import (
	"encoding/json"
	"io"
	"math/rand"
	"os"
	"path"
	"time"
)

type Block struct {
	Index int    `json:"index"`
	Id    string `json:"id"`
	Img   string `json:"img"`
	Cmd   string `json:"cmd"`
}

type Config struct {
	Blocks map[string]*Block `json:"blocks"`
	Secret string            `json:"secret"`
}

func randomSecret() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	seededRand := rand.New(rand.NewSource(time.Now().UnixNano()))
	data := make([]byte, 8)
	for i := range data {
		data[i] = charset[seededRand.Intn(len(charset))]
	}
	return string(data)
}

func LoadConfig() {
	config = &Config{}
	logger.Logf("Loading config from %s", configPath)
	if _, err := os.Stat(configPath); err == nil {
		// config exists
		file, err := os.Open(configPath)
		if err != nil {
			logger.Fatalln(err)
		}
		defer file.Close()

		bytes, err := io.ReadAll(file)
		if err != nil {
			logger.Fatalln(err)
		}
		err = json.Unmarshal(bytes, config)
		if err != nil {
			logger.Fatalln(err)
		}
		if config.Secret == "" {
			logger.Logln("Secret is empty. Generating a new one...")
			config.Secret = randomSecret()
			data, err := json.Marshal(config)
			if err == nil && os.WriteFile(configPath, data, 0o644) == nil {
				logger.Logln("Saved new config with secret")
			}
		}
		logger.Logf("Loaded config. Found %d block(s)", len(config.Blocks))
	} else {
		logger.Logln("Config is empty (and that's fine!)")
	}
}

func SaveConfig() {
	data, err := json.Marshal(config)
	if err != nil {
		logger.Logln(err)
		return
	}
	err = os.MkdirAll(path.Dir(configPath), 0o755)
	if err != nil {
		logger.Logln("mkdir failed")
		logger.Logln(err)
		return
	}
	err = os.WriteFile(configPath, data, 0o644)
	if err != nil {
		logger.Logln("write failed")
		logger.Logln(err)
		return
	}
}
