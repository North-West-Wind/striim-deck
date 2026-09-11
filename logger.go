package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/data/binding"
	"fyne.io/fyne/v2/widget"
)

type loggerStruct struct {
	logList       *widget.List
	logLines      []string
	logData       binding.StringList
	stickToBottom bool
}

var logger = loggerStruct{
	logLines:      make([]string, 0),
	stickToBottom: true,
}

func (l *loggerStruct) commitLog(line string) {
	line = time.Now().Format("2006-01-02 15:04:05") + " " + line
	if l.logData == nil {
		l.logLines = append(l.logLines, line)
	} else {
		l.logData.Append(line)
		if l.stickToBottom && l.logList != nil {
			fyne.Do(func() {
				l.logList.ScrollToBottom()
			})
		}
	}
}

func (l *loggerStruct) Logf(format string, a ...any) {
	for line := range strings.SplitSeq(strings.Trim(fmt.Sprintf(format, a...), " \t\n\r"), "\n") {
		l.commitLog(line)
	}
	log.Printf(format, a...)
}

func (l *loggerStruct) Logln(a ...any) {
	for line := range strings.SplitSeq(strings.Trim(fmt.Sprint(a...), " \t\n\r"), "\n") {
		l.commitLog(line)
	}
	log.Println(a...)
}

func (l *loggerStruct) Fatalln(a ...any) {
	log.Fatalln(a...)
}

func (l *loggerStruct) Write(data []byte) (int, error) {
	for line := range strings.SplitSeq(strings.Trim(string(data), " \t\n\r"), "\n") {
		l.commitLog(line)
	}
	return os.Stdout.Write(data)
}
