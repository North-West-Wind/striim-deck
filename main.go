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
	"path/filepath"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"github.com/adrg/xdg"
	"github.com/google/uuid"
	shellwords "github.com/mattn/go-shellwords"
)

var (
	config     *Config
	configPath string
	imageDir   string
	scriptDir  string
	port       int
	window     fyne.Window
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
	scriptDir, err = xdg.ConfigFile("striim-deck/scripts")
	if err != nil {
		log.Fatalln(err)
	}
	scriptDir, err = filepath.Abs(scriptDir)
	if err != nil {
		log.Fatalln(err)
	}
	if entries, err := os.ReadDir(imageDir); err != nil || len(entries) == 0 {
		log.Printf("%s is empty. You should put images there!", imageDir)
		os.MkdirAll(imageDir, 0755)
	}
	if entries, err := os.ReadDir(scriptDir); err != nil || len(entries) == 0 {
		log.Printf("%s is empty. You should put scripts there!", scriptDir)
		os.MkdirAll(scriptDir, 0755)
	}
	pathEnv, _ := os.LookupEnv("PATH")
	if pathEnv == "" {
		os.Setenv("PATH", scriptDir)
	} else {
		os.Setenv("PATH", pathEnv+":"+scriptDir)
	}
	flag.StringVar(&configPath, "config", configPath, "Config file path")
	flag.IntVar(&port, "port", 8000, "Port of the HTTP server")
}

func main() {
	LoadConfig()

	go httpServer()

	a := app.New()
	window = a.NewWindow("Confirmation")
	window.SetFixedSize(true)

	a.Run()
}

func httpServer() {
	router := http.NewServeMux()

	router.HandleFunc("GET /wiiu/", serveWiiU)
	router.HandleFunc("POST /api/log", handleLog)
	router.HandleFunc("GET /api/blocks", getBlocks)
	router.HandleFunc("POST /api/new", newBlock)
	router.HandleFunc("POST /api/delete", deleteBlock)
	router.HandleFunc("POST /api/run", runBlock)
	router.HandleFunc("POST /api/swap", swapBlock)
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
	result := make(chan bool)
	fyne.Do(func() {
		window.SetCloseIntercept(func() {
			window.Close()
			result <- false
		})
		window.SetContent(container.NewVBox(
			widget.NewLabel("A client has requested adding the following command:"),
			widget.NewLabel(body.Cmd),
			widget.NewButton("Accept", func() {
				window.Hide()
				result <- true
			}),
			widget.NewButton("Reject", func() {
				window.Hide()
				result <- false
			}),
		))
		window.Show()
	})
	ans := <-result
	if ans {
		log.Println("Accepted")
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
		log.Println("Rejected")
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

func swapBlock(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	all, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("500 Internal Server Error"))
		return
	}
	var a, b int
	fmt.Sscanf(string(all), "%d %d", &a, &b)
	if config.Blocks == nil {
		w.Write([]byte("200 OK"))
		return
	}
	var blockA, blockB *Block
	for _, block := range config.Blocks {
		if block.Index == a {
			blockA = block
			if blockB != nil {
				break
			}
		} else if block.Index == b {
			blockB = block
			if blockA != nil {
				break
			}
		}
	}
	if blockA != nil {
		blockA.Index = b
	}
	if blockB != nil {
		blockB.Index = a
	}
	w.Write([]byte("200 OK"))
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
			if entry.IsDir() {
				continue
			}
			body.WriteString(entry.Name() + "\n")
		}
		w.Write([]byte(body.String()))
	} else {
		r.URL.Path = r.URL.Path[12:]
		fs.ServeHTTP(w, r)
	}
}
