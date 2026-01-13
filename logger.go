package main

import (
	"fmt"
	"log"
	"strings"
	"time"

	"fyne.io/fyne/v2/data/binding"
	"fyne.io/fyne/v2/widget"
)

var (
	logList  *widget.List
	logLines []string
	logData  binding.StringList
)

func commitLog(line string) {
	line = time.Now().Format("2006-01-02 15:04:05") + " " + line
	if logData == nil {
		logLines = append(logLines, line)
	} else {
		logData.Append(line)
	}
}

func Logf(format string, a ...any) {
	for line := range strings.SplitSeq(strings.Trim(fmt.Sprintf(format, a...), " \t\n\r"), "\n") {
		commitLog(line)
	}
	log.Printf(format, a...)
}

func Logln(a ...any) {
	for line := range strings.SplitSeq(strings.Trim(fmt.Sprint(a...), " \t\n\r"), "\n") {
		commitLog(line)
	}
	log.Println(a...)
}

func Fatalln(a ...any) {
	log.Fatalln(a...)
}
