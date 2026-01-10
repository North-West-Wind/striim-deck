package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"

	"github.com/adrg/xdg"
	"github.com/google/uuid"
	shellwords "github.com/mattn/go-shellwords"
)

var (
	config     *Config
	configPath string
	imageDir   string
	port       int
)

func init() {
	var err error
	configPath, err = xdg.ConfigFile("striim-deck/config.json")
	if err != nil {
		log.Fatalln(err)
	}
	imageDir, err = xdg.ConfigFile("striim-deck/images")
	if err != nil {
		log.Fatalln(err)
	}
	if entries, err := os.ReadDir(imageDir); err != nil || len(entries) == 0 {
		log.Printf("%s is empty. You should put images there!", imageDir)
		os.MkdirAll(imageDir, 0755)
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
	router.HandleFunc("POST /api/delete", deleteBlock)
	router.HandleFunc("POST /api/run", runBlock)
	router.HandleFunc("GET /api/images/", getImages)

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
		Img   string `json:"img"`
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
			Img:   body.Img,
		}
		if config.Blocks == nil {
			config.Blocks = map[string]*Block{}
		}
		config.Blocks[id.String()] = &block
		data, err := json.Marshal(block)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte("500 Internal Server Error"))
			return
		}
		w.Header().Add("Content-Type", "application/json")
		w.Write(data)
		SaveConfig()
	} else {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("403 Forbidden"))
	}
}

func deleteBlock(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	all, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("500 Internal Server Error"))
		return
	}
	id := string(all)
	delete(config.Blocks, id)
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("200 OK"))
	SaveConfig()
}

func runBlock(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	all, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("500 Internal Server Error"))
		return
	}
	id := string(all)
	block := config.Blocks[id]
	if block == nil {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte("404 Not Found"))
		return
	}
	argv, err := shellwords.Parse(block.Cmd)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("500 Internal Server Error"))
		return
	}
	output, err := exec.Command(argv[0], argv[1:]...).Output()
	if err != nil {
		log.Println(err)
		w.WriteHeader(http.StatusGone)
		w.Write([]byte(""))
	} else {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(output))
	}
}

func getImages(w http.ResponseWriter, r *http.Request) {
	fs := http.FileServer(http.Dir(imageDir))
	log.Println(r.URL.Path)
	if r.URL.Path == "/api/images/" {
		entries, err := os.ReadDir(imageDir)
		if err != nil {
			w.Write(make([]byte, 0))
			return
		}
		var body strings.Builder
		for _, entry := range entries {
			body.WriteString(entry.Name() + "\n")
		}
		w.Write([]byte(body.String()))
	} else {
		r.URL.Path = r.URL.Path[12:]
		fs.ServeHTTP(w, r)
	}
}
