
function getDB() {
    var db = document.querySelector('input[name="state-database"]:checked').value;
    return db;
}
function getDBname(db) {
    if (db == 'b') {
        dbname = 'biomechanics';
    }
    if (db == 'v') {
        dbname = 'vehicle';
    }
    if (db == 'c') {
        dbname = 'component';
    }
    return dbname;
}
function getDBstr(db) {
    if (db == 'b') {
        dbStr = 'biodb';
    }
    if (db == 'v') {
        dbStr = 'vehdb';
    }
    if (db == 'c') {
        dbStr = 'comdb';
    }
    return dbStr;
}
function makePlot() {
    var TSTNO = document.getElementById("TSTNO").value;
    var CURNO = document.getElementById("CURNO").value;
    
    dbname = getDBname(getDB());

    let fetchRes = fetch("https://nrd.api.nhtsa.dot.gov/nhtsa/" + dbname + "/api/v1/" + dbname + "-database-test-results/get-instrumentation-detail-info/" + CURNO + "/" + TSTNO);
        fetchRes.then(res => res.json()).then(d => fetchData(d['results'][0]))
    
};

function getINST() {
    var TSTNO = document.getElementById("TSTNO").value;
    
    dbname = getDBname(getDB());

    var instURL = "https://nrd.api.nhtsa.dot.gov/nhtsa/" + dbname + "/api/v1/" + dbname + "-database-test-results/get-instrumentation-info/" + TSTNO + "?count=999&orderBy=curveNo&sortBy=ASC"

    let fetchRes = fetch(instURL);
        fetchRes.then(res => res.json()).then(d => makeINSTtable(d['results']))
    
};

function makeINSTtable(details) {
    Toastify({
        text: "Loading instrumentation table using API",
        duration: 5000
      }).showToast();
    //document.getElementById("database").html = "";
    document.getElementById("instList").innerHtml = "";
    var tableHTML = '<table id="instTable" class="instTable"><tr>';
    for(var key in details[0]) {
        tableHTML += '<th>' + key + '</th>';
    }
    tableHTML += '</tr>';
    for(var item in details) {
        tableHTML += '<tr onclick="plotRow(this)">';
        for(var key in details[item]) {
            tableHTML += '<td>' + details[item][key] + '</td>';
        }
        tableHTML += '</tr>';
    }
    tableHTML += '</table>';

    document.getElementById("instList").innerHTML = tableHTML;
}

function plotRow(row) {
    var TSTNO = row.cells[1].textContent;
    var CURNO = row.rowIndex;
    
    dbname = getDBname(getDB());

    let fetchRes = fetch("https://nrd.api.nhtsa.dot.gov/nhtsa/" + dbname + "/api/v1/" + dbname + "-database-test-results/get-instrumentation-detail-info/" + CURNO + "/" + TSTNO);
        fetchRes.then(res => res.json()).then(d => fetchData(d['results'][0]))

}

// generate ASCII file URL from details
function getASCII(details) {
    
    var TSTNO = details.testNo;
    var CURNO = details.curveNo;
    
    db = getDB();
    dbname = getDBname(db);
    dbStr = getDBstr(db);

    var baseURL = "https://nrd-static.nhtsa.dot.gov/tsv/"
    baseURL += dbStr + '/';
    baseURL += db + (Math.floor(TSTNO/10000)*10000).toString().padStart(5,'0') + '/';
    baseURL += db + (Math.floor(TSTNO/100)*100).toString().padStart(5,'0') + '/';
    baseURL += db + TSTNO.toString().padStart(5,'0') + '/';
    baseURL += db + TSTNO.toString().padStart(5,'0') + 'tsv.' + CURNO.toString().padStart(3,'0');
    return baseURL;
}

// get data from data URL
async function fetchData(details) {
    if (details.asciiFile == "ASCII X-Y") {
        details.asciiFile = getASCII(details);
    }

    plotData = downloadData(details);

}

// download data without fetch
function downloadData(details) {
    var toast = Toastify({
        text: "Downloading plot data for CURNO " + details.curveNo,
        duration: 5000
      });
    toast.showToast()
    var request = new XMLHttpRequest();
    request.open('GET', details.asciiFile, true);
    request.send(null);
    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status === 200) {
            toast.hideToast()
            var type = request.getResponseHeader('Content-Type');
            if (type.indexOf("text") !== 1) {
                buildBokeh(request.responseText,details);
            }
        }
    }
}

function copyData() {
    var ds = Bokeh.documents[0].get_model_by_name('PlotData');
    value1=ds.data['x'];
    value2=ds.data['y'];
    var out = "";
    for (i = 0; i < value1.length; i++) {
        out += value1[i] + ", " + value2[i] + "\n";
    }
    navigator.clipboard.writeText(out).then(function() {
        Toastify({
            text: "Plot data copied to clipboard!",
            duration: 5000
          }).showToast();
      }, function() {
        Toastify({
            text: "Error copying plot data copied to clipboard.",
            duration: 5000,
          }).showToast();
      });
}

function buildBokeh(data,details) {

    // parse X, Y data from data; if 1 column, generate time channel
    var allTextLines = data.split(/\r\n|\n/);
    var timeChn = [];
    var dataChn = [];

    for (var i=1; i<allTextLines.length; i++) {
        var temp = allTextLines[i].split('\t');
        if (temp.length == 2) {
            timeChn.push(parseFloat(temp[0]));
            dataChn.push(parseFloat(temp[1]));
        } else if (data.length == 1) {
            dataChn.push(parseFloat(temp[0]));
        }
    }
    
    function makeNewTimeChn(dataChn, details){
        timeChn = [];
        for (var i=1; i<=dataChn.length; i++) {
            timeChn.push(parseInt(details.numberofFirstPoint) * (parseInt(details.timeIncrement) / 1000000.) + (parseInt(details.timeIncrement) / 1000000.)*i);
        }
    }
    // check to see if time channel is meaningful
    if (timeChn != []){
        if (timeChn[1] - timeChn[0] == 0) {
            // time exists, but is meaningless
            makeNewTimeChn(dataChn, details);
        }
    } else if (timeChn == []){
        makeNewTimeChn(dataChn, details);        
    }

    // create a data source to hold data
    const source = new Bokeh.ColumnDataSource({
        data: { x: timeChn, y: dataChn },
        name: "PlotData"
    });

    var plotTitle = ''
    plotTitle +=  getDB();
    plotTitle += "-" + details.testNo;
    plotTitle += "-" + details.curveNo + " (";
    if ('vehicleNo' in details) {
        plotTitle += "V" + details.vehicleNo + " ";
    }
    // for now, pull sensor location from table (TODO add to get-instrumentation-detail-info)
    var table = document.getElementById('instTable');
    plotTitle += table.rows[details.curveNo].cells[4].textContent + " ";
    plotTitle += details.sensorAttachment + " ";
    plotTitle += details.sensorType + " ";
    plotTitle += details.axisDirofSensor + " ";
    plotTitle += "[" + details.dataMeasurementUnits + "])";

    // make a plot with some tools
    const plot = Bokeh.Plotting.figure({
        tools: "pan,wheel_zoom,box_zoom,reset,save,copy",
        height: 400,
        width: 800
    });
    // doesn't work with BokehJS
    // tools: [PanTool(), WheelZoomTool(), BoxZoomTool(), ResetTool(), SaveTool(), CopyTool()],

    //plot.add_layout(Bokeh.Models.Title(text=details.instrumentationCommentary, text_font_size="12pt", text_font_style="italic"), 'above')
    //plot.add_layout(Bokeh.Models.Title(text=plotTitle, text_font_size="16pt"), 'above')
    plot.title = plotTitle + '\n' + details.instrumentationCommentary;

    // add a line with data from the source
    plot.line({ field: "x" }, { field: "y" }, {
        source: source,
        line_width: 2
    });

    // set axis titles
    plot.xaxis.axis_label = "Time (s)";
    plot.yaxis.axis_label = details.dataMeasurementUnits;
    // set axis ranges
    plot.xaxis.bounds = 'auto';
    plot.yaxis.bounds = 'auto';

    plot.sizing_mode = 'stretch_both' 
    // clear plot output div
    document.getElementById("output").innerHTML = ""
    // show the plot, appending it to the end of the current section
    Bokeh.Plotting.show(plot, document.getElementById("output"));

}

