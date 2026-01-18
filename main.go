package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/data/binding"
	"fyne.io/fyne/v2/driver/desktop"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
	"github.com/adrg/xdg"
	"github.com/google/uuid"
	shellwords "github.com/mattn/go-shellwords"
)

var (
	configPath string
	noGui      bool
	port       int

	wiiuFs    http.Handler
	imageFs   http.Handler
	selfPath  string
	config    *Config
	imageDir  string
	scriptDir string
	popup     fyne.Window
)

func init() {
	var err error
	selfPath, err = os.Executable()
	if err != nil {
		Fatalln(err)
	}
	selfPath = path.Dir(selfPath)

	clientPath := path.Join(selfPath, "client/dist")
	stat, err := os.Stat(clientPath)
	if err != nil {
		// Try to find in working directory
		selfPath = "."
		clientPath = path.Join(selfPath, "client/dist")
		stat, err = os.Stat(clientPath)
		if err != nil {
			Fatalln(errors.New("Cannot find client files"))
		}
	}
	if !stat.IsDir() {
		Fatalln(errors.New("Client path is not a directory. Make sure striim-deck is in the same directory as the client directory."))
	}
	wiiuFs = http.FileServer(http.Dir(clientPath))

	configPath, err = xdg.ConfigFile("striim-deck/config.json")
	if err != nil {
		Fatalln(err)
	}
	imageDir, err = xdg.ConfigFile("striim-deck/images")
	if err != nil {
		Fatalln(err)
	}
	imageFs = http.FileServer(http.Dir(imageDir))
	scriptDir, err = xdg.ConfigFile("striim-deck/scripts")
	if err != nil {
		Fatalln(err)
	}
	scriptDir, err = filepath.Abs(scriptDir)
	if err != nil {
		Fatalln(err)
	}
	if entries, err := os.ReadDir(imageDir); err != nil || len(entries) == 0 {
		Logf("%s is empty. You should put images there!", imageDir)
		os.MkdirAll(imageDir, 0755)
	}
	if entries, err := os.ReadDir(scriptDir); err != nil || len(entries) == 0 {
		Logf("%s is empty. You should put scripts there!", scriptDir)
		os.MkdirAll(scriptDir, 0755)
	}
	pathEnv, _ := os.LookupEnv("PATH")
	if pathEnv == "" {
		os.Setenv("PATH", scriptDir)
	} else {
		os.Setenv("PATH", pathEnv+":"+scriptDir)
	}
	flag.StringVar(&configPath, "config", configPath, "Config file path")
	flag.BoolVar(&noGui, "nogui", false, "Disable GUI (including system tray)")
	flag.IntVar(&port, "port", 3112, "Port of the HTTP server")

	flag.Parse()
}

func main() {
	LoadConfig()

	if noGui {
		httpServer()
		return
	}
	go httpServer()

	a := app.New()
	logData = binding.BindStringList(&logLines)
	logList = widget.NewListWithData(logData, func() fyne.CanvasObject {
		label := widget.NewLabel("")
		label.Selectable = true
		return label
	}, func(item binding.DataItem, co fyne.CanvasObject) {
		co.(*widget.Label).Bind(item.(binding.String))
	})
	window := a.NewWindow("Striim Deck")
	mainLabel := widget.NewLabel("Striim Deck Server Log")
	mainLabel.SizeName = theme.SizeNameHeadingText
	vBox := container.NewVBox(container.NewHBox(
		mainLabel,
		widget.NewButton("Exit", func() {
			os.Exit(0)
		}),
	))
	if desk, ok := a.(desktop.App); ok {
		// We can use system tray
		window.SetCloseIntercept(func() {
			window.Hide()
		})
		menu := fyne.NewMenu("Striim Deck", fyne.NewMenuItem("Show GUI", func() {
			window.Show()
		}))
		desk.SetSystemTrayMenu(menu)
	} else {
		// No system tray sadness
		window.SetOnClosed(func() {
			os.Exit(0)
		})

		subLabel := widget.NewLabel("Closing this window exits the program")
		subLabel.SizeName = theme.SizeNameSubHeadingText
		vBox.Add(subLabel)
	}
	var scrollButton *widget.Button
	scrollButton = widget.NewButton("Scroll To Bottom", func() {
		stickToBottom = !stickToBottom
		if stickToBottom {
			logList.ScrollToBottom()
			scrollButton.Importance = widget.SuccessImportance
		} else {
			scrollButton.Importance = widget.MediumImportance
		}
	})
	scrollButton.Importance = widget.SuccessImportance
	vBox.Add(container.NewHBox(
		widget.NewButton("Open Image Directory", func() {
			openDirectory(imageDir)
		}),
		widget.NewButton("Open Script Directory", func() {
			openDirectory(scriptDir)
		}),
		scrollButton,
	))
	window.SetContent(container.NewBorder(vBox, nil, nil, nil, logList))
	popup = a.NewWindow("Confirmation")
	popup.SetFixedSize(true)

	window.ShowAndRun()
}

func openDirectory(path string) {
	var cmd string

	// Chat is this real?
	// Idk I haven't used Windows or Mac in 5 years
	switch runtime.GOOS {
	case "windows":
		cmd = "explorer"
	case "darwin":
		cmd = "open"
	default:
		cmd = "xdg-open"
	}
	child := exec.Command(cmd, path)
	child.Start()
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

	Logf("Starting server at port %d", port)
	err := http.ListenAndServe(fmt.Sprintf(":%d", port), router)
	if err != nil {
		Fatalln(err)
	}
}

func serveWiiU(w http.ResponseWriter, r *http.Request) {
	Logln(r.URL.Path)
	if r.URL.Path == "/wiiu/" {
		http.ServeFile(w, r, path.Join(selfPath, "client/dist/index.html"))
	} else {
		r.URL.Path = r.URL.Path[6:]
		wiiuFs.ServeHTTP(w, r)
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
	Logln(string(all))
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
	var accepted bool
	if noGui {
		var ans string
		Logln("A client has requested adding the following command:")
		Logln(body.Cmd)
		Logf("Accept? [y/n]")
		fmt.Scanf("%s", &ans)
		accepted = strings.ToLower(strings.TrimSpace(ans)) == "y"
	} else {
		result := make(chan bool)
		fyne.Do(func() {
			popup.SetCloseIntercept(func() {
				popup.Close()
				result <- false
			})
			popup.SetContent(container.NewVBox(
				widget.NewLabel("A client has requested adding the following command:"),
				widget.NewLabel(body.Cmd),
				widget.NewButton("Accept", func() {
					popup.Hide()
					result <- true
				}),
				widget.NewButton("Reject", func() {
					popup.Hide()
					result <- false
				}),
			))
			popup.Show()
		})
		accepted = <-result
	}
	if accepted {
		Logln("Accepted")
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
		Logln("Rejected")
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
		Logln(err)
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
	SaveConfig()
}

func getImages(w http.ResponseWriter, r *http.Request) {
	Logln(r.URL.Path)
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
		imageFs.ServeHTTP(w, r)
	}
}
