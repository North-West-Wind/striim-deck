package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/adrg/xdg"
	"github.com/google/uuid"
)

var (
	config     *Config
	configPath string
	port       int
)

func init() {
	var err error
	configPath, err = xdg.ConfigFile("striim-deck/config.json")
	if err != nil {
		log.Fatalln(err)
	}
	flag.StringVar(&configPath, "config", configPath, "Config file path")
	flag.IntVar(&port, "port", 8000, "Port of the HTTP server")
}

func main() {
	LoadConfig()

	router := http.NewServeMux()

	router.HandleFunc("GET /wiiu/", serveWiiU)
	router.HandleFunc("POST /api/log", handleLog)
	router.HandleFunc("GET /api/blocks", getBlocks)
	router.HandleFunc("POST /api/new", newBlock)

	err := http.ListenAndServe(fmt.Sprintf(":%d", port), router)
	if err != nil {
		log.Fatalln(err)
	}
}

func serveWiiU(w http.ResponseWriter, r *http.Request) {
	fs := http.FileServer(http.Dir("client/dist"))
	log.Println(r.URL.Path)
	if r.URL.Path == "/wiiu/" {
		http.ServeFile(w, r, "client/dist/index.html")
	} else {
		r.URL.Path = r.URL.Path[6:]
		fs.ServeHTTP(w, r)
	}
}

func handleLog(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	all, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("500 Internal Server Error"))
		return
	}
	log.Println(string(all))
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("200 OK"))
}

func getBlocks(w http.ResponseWriter, r *http.Request) {
	data, err := json.Marshal(config.Blocks)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("500 Internal Server Error"))
		return
	}
	w.Header().Add("Content-Type", "application/json")
	w.Write(data)
}

func newBlock(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	all, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("500 Internal Server Error"))
		return
	}
	body := struct {
		Index int    `json:"index"`
		Cmd   string `json:"cmd"`
	}{}
	err = json.Unmarshal(all, &body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("500 Internal Server Error"))
		return
	}
	fmt.Println("A client has requested adding the following command:")
	fmt.Println(body.Cmd)
	fmt.Print("Accept? [y/n] ")
	var ans string
	fmt.Scan(&ans)
	if strings.TrimSpace(strings.ToLower(ans)) == "y" {
		id, err := uuid.NewRandom()
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("500 Internal Server Error"))
			return
		}
		block := Block{
			Index: body.Index,
			Id:    id.String(),
			Cmd:   body.Cmd,
		}
		if config.Blocks == nil {
			config.Blocks = []Block{}
		}
		config.Blocks = append(config.Blocks, block)
		data, err := json.Marshal(block)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("500 Internal Server Error"))
			return
		}
		SaveConfig()
		w.Header().Add("Content-Type", "application/json")
		w.Write(data)
	} else {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("403 Forbidden"))
	}
}
