package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
)

var (
	port int
)

func init() {
	flag.IntVar(&port, "port", 8000, "Port of the HTTP server")
}

func main() {
	router := http.NewServeMux()

	router.HandleFunc("GET /wiiu/", serveWiiU)

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
