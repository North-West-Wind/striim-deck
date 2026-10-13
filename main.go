package main

import (
	"embed"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
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
	autoAccept bool
	configPath string
	noGui      bool
	noTrust    bool
	port       int

	//go:embed client/dist
	embedFs   embed.FS
	wiiuFs    http.Handler
	imageFs   http.Handler
	config    *Config
	imageDir  string
	scriptDir string
	popup     fyne.Window
)

func init() {
	var err error
	configPath, err = xdg.ConfigFile("striim-deck/config.json")
	if err != nil {
		logger.Fatalln(err)
	}
	wiiuFs = http.FileServer(http.FS(embedFs))
	imageDir, err = xdg.ConfigFile("striim-deck/images")
	if err != nil {
		logger.Fatalln(err)
	}
	imageFs = http.FileServer(http.Dir(imageDir))
	scriptDir, err = xdg.ConfigFile("striim-deck/scripts")
	if err != nil {
		logger.Fatalln(err)
	}
	scriptDir, err = filepath.Abs(scriptDir)
	if err != nil {
		logger.Fatalln(err)
	}
	if entries, err := os.ReadDir(imageDir); err != nil || len(entries) == 0 {
		logger.Logf("%s is empty. You should put images there!", imageDir)
		os.MkdirAll(imageDir, 0755)
	}
	if entries, err := os.ReadDir(scriptDir); err != nil || len(entries) == 0 {
		logger.Logf("%s is empty. You should put scripts there!", scriptDir)
		os.MkdirAll(scriptDir, 0755)
	}
	pathEnv, _ := os.LookupEnv("PATH")
	if pathEnv == "" {
		os.Setenv("PATH", scriptDir)
	} else {
		os.Setenv("PATH", pathEnv+":"+scriptDir)
	}
	flag.BoolVar(&autoAccept, "autoaccept", false, "Automatically accept new blocks")
	flag.StringVar(&configPath, "config", configPath, "Config file path")
	flag.BoolVar(&noGui, "nogui", false, "Disable GUI (including system tray)")
	flag.BoolVar(&noTrust, "notrust", false, "Disable trusted clients")
	flag.IntVar(&port, "port", 3112, "Port of the HTTP server")

	flag.Parse()
}

func main() {
	if autoAccept {
		logger.Logln("Auto-accept mode is ON")
	}
	LoadConfig()

	if noGui {
		httpServer()
		return
	}
	go httpServer()

	var iconResource fyne.Resource
	icon, err := embedFs.ReadFile("client/dist/icon.png")
	if err == nil {
		iconResource = fyne.NewStaticResource("icon.png", icon)
	}

	a := app.New()
	a.SetIcon(iconResource)
	logger.logData = binding.BindStringList(&logger.logLines)
	logger.logList = widget.NewListWithData(logger.logData, func() fyne.CanvasObject {
		label := widget.NewLabel("")
		label.Selectable = true
		return label
	}, func(item binding.DataItem, co fyne.CanvasObject) {
		co.(*widget.Label).Bind(item.(binding.String))
	})
	window := a.NewWindow("Striim Deck")
	window.SetIcon(iconResource)
	mainLabel := widget.NewLabel("Striim Deck Server Log")
	mainLabel.SizeName = theme.SizeNameHeadingText
	secretLabel := widget.NewLabel(fmt.Sprintf("Secret: %s", config.Secret))
	secretLabel.SizeName = theme.SizeNameHeadingText
	secretLabel.Hide()
	vBox := container.NewVBox(container.NewHBox(
		mainLabel,
		widget.NewButton("Exit", func() {
			os.Exit(0)
		}),
		secretLabel,
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
		desk.SetSystemTrayIcon(iconResource)
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
		logger.stickToBottom = !logger.stickToBottom
		if logger.stickToBottom {
			logger.logList.ScrollToBottom()
			scrollButton.Importance = widget.SuccessImportance
		} else {
			scrollButton.Importance = widget.MediumImportance
		}
	})
	scrollButton.Importance = widget.SuccessImportance
	var secretButton *widget.Button
	secretButton = widget.NewButton("Show secret", func() {
		if secretLabel.Visible() {
			secretButton.Importance = widget.MediumImportance
			secretLabel.Hide()
		} else {
			secretButton.Importance = widget.DangerImportance
			secretLabel.Show()
		}
	})
	vBox.Add(container.NewHBox(
		widget.NewButton("Open Image Directory", func() {
			openDirectory(imageDir)
		}),
		widget.NewButton("Open Script Directory", func() {
			openDirectory(scriptDir)
		}),
		scrollButton,
		secretButton,
	))
	window.SetContent(container.NewBorder(vBox, nil, nil, nil, logger.logList))
	popup = a.NewWindow("Confirmation")
	popup.SetIcon(iconResource)
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

	logger.Logf("Starting server at port %d", port)
	err := http.ListenAndServe(fmt.Sprintf(":%d", port), router)
	if err != nil {
		logger.Fatalln(err)
	}
}

func serveWiiU(w http.ResponseWriter, r *http.Request) {
	logger.Logln(r.URL.Path)
	file := r.URL.Path[6:]
	if strings.Contains(r.Header.Get("user-agent"), "Nintendo WiiU") && file == "style.css" {
		logger.Logln("Received style.css request from Wii U. Replacing with style.wiiu.css...")
		file = "style.wiiu.css"
	}
	r.URL.Path = "client/dist/" + file
	wiiuFs.ServeHTTP(w, r)
}

func handleLog(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	all, err := io.ReadAll(r.Body)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("500 Internal Server Error"))
		return
	}
	logger.Logln(string(all))
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("200 OK"))
}

func checkAuth(w http.ResponseWriter, r *http.Request) bool {
	client := strings.Split(r.RemoteAddr, ":")[0] + ";" + r.Header.Get("x-forwarded-for")
	if !noTrust {
		for _, trusted := range config.Trusted {
			if trusted == client {
				return true
			}
		}
	}
	if r.Header.Get("Authorization") == config.Secret {
		if !noTrust {
			config.Trusted = append(config.Trusted, client)
			SaveConfig()
			logger.Logf("Added %s to trusted list", client)
		}
		return true
	}
	return false
}

func getBlocks(w http.ResponseWriter, r *http.Request) {
	if !checkAuth(w, r) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("403 Forbidden"))
		return
	}
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
	if !checkAuth(w, r) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("403 Forbidden"))
		return
	}
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
	if autoAccept {
		accepted = true
	} else if noGui {
		var ans string
		logger.Logln("A client has requested adding the following command:")
		logger.Logln(body.Cmd)
		logger.Logf("Accept? [y/n]")
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
		logger.Logln("Accepted")
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
		logger.Logln("Rejected")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte("401 Unauthorized"))
	}
}

func deleteBlock(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	if !checkAuth(w, r) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("403 Forbidden"))
		return
	}
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
	if !checkAuth(w, r) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("403 Forbidden"))
		return
	}
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
	cmd := exec.Command(argv[0], argv[1:]...)
	cmd.Stdout = &logger
	cmd.Stderr = &logger
	err = cmd.Run()
	if err != nil {
		logger.Logln(err)
		w.WriteHeader(http.StatusGone)
		w.Write([]byte(""))
	} else {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(""))
	}
}

func swapBlock(w http.ResponseWriter, r *http.Request) {
	defer r.Body.Close()
	if !checkAuth(w, r) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("403 Forbidden"))
		return
	}
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
	logger.Logln(r.URL.Path)
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
