const loadDataIntraday = d3.json("/yahoo.json").then(json => {
  const chartData = json.chart.result[0];
  const quoteData = chartData.indicators.quote[0];
  return chartData.timestamp.map((d, i) => ({
    date: new Date(d * 1000 - 5 * 1000 * 60 * 60),
    high: quoteData.high[i],
    low: quoteData.low[i],
    open: quoteData.open[i],
    close: quoteData.close[i],
    volume: quoteData.volume[i]
  }));
});

const dateFormat = d3.timeFormat("%a %H:%M%p");
const priceFormat = d3.format(".2f");

const loadDataEndOfDay = d3.csv("/yahoo.csv", d => {
  d.date = new Date(d.Timestamp * 1000);
  d.volume = Number(d.volume);
  d.high = Number(d.high);
  d.low = Number(d.low);
  d.open = Number(d.open);
  d.close = Number(d.close);
  return d;
});

const volumeSeries = fc
  .seriesSvgBar()
  .bandwidth(3)
  .crossValue(d => d.date)
  .decorate(sel =>
    sel
      .enter()
      .classed("volume", true)
      .attr("fill", d => (d.open > d.close ? "red" : "green"))
  );

const movingAverageSeries = fc
  .seriesSvgLine()
  .mainValue(d => d.ma)
  .crossValue(d => d.date)
  .decorate(sel => {
    sel.enter().classed("ema", true);
  });

const lineSeries = fc
  .seriesSvgLine()
  .mainValue(d => d.high)
  .crossValue(d => d.date);

const areaSeries = fc
  .seriesSvgArea()
  .mainValue(d => d.high)
  .crossValue(d => d.date);

const gridlines = fc
  .annotationSvgGridline()
  .yTicks(5)
  .xTicks(0);

const annotation = fc
  .annotationSvgLine()
  .label(d => priceFormat(d))
  .decorate(function(sel) {
    sel
      .enter()
      .select(".right-handle")
      .append("g")
      .attr("transform", "translate(-50, 0)")
      .call(callout());
  });

const chartLegend = legend();

const multi = fc
  .seriesSvgMulti()
  .series([
    gridlines,
    areaSeries,
    volumeSeries,
    movingAverageSeries,
    lineSeries,
    annotation,
    chartLegend
  ])
  .mapping((data, index, series) => {
    const lastPoint = data[data.length - 1];
    switch (series[index]) {
      case annotation:
        return [lastPoint.high, lastPoint.ma];
      case chartLegend:
        return ["open", "high", "low", "close"].map(key => ({
          name: key,
          value: priceFormat(lastPoint[key])
        }));
      default:
        return data;
    }
  });

const ma = fc.indicatorMovingAverage().value(d => d.high);

// use the extent component to determine the x and y domain
const xExtent = fc
  .extentDate()
  .pad([0, 0.05])
  .accessors([d => d.date]);
const volumeExtent = fc
  .extentLinear()
  .pad([0, 2])
  .accessors([d => d.volume]);
const yExtent = fc
  .extentLinear()
  .pad([0.1, 0.1])
  .accessors([d => d.high, d => d.low]);

const chart = fc
  .chartSvgCartesian(d3.scaleTime(), d3.scaleLinear())
  .yOrient("right")
  .plotArea(multi)
  .xTickFormat(dateFormat)
  .yTickFormat(priceFormat)
  .yTicks(5)
  // https://github.com/d3/d3-axis/issues/32
  .yTickSize(0.1)
  .yDecorate(sel => {
    sel
      .select("text")
      .style("text-anchor", "end")
      .attr("transform", "translate(-3, -8)");
  })
  .xDecorate(sel => {
    sel
      .select("text")
      .attr("dy", undefined)
      .style("text-anchor", "start")
      .style("dominant-baseline", "central")
      .attr("transform", "translate(3, 10)");
  });

loadDataEndOfDay.then(data => {
  // compute the moving average data
  const maData = ma(data);

  // merge into a single series
  const mergedData = data.map((d, i) =>
    Object.assign(d, {
      ma: maData[i]
    })
  );

  // set the domain based on the data
  const xDomain = xExtent(data);
  const yDomain = yExtent(data);
  const volumeDomain = volumeExtent(data);

  chart.xDomain(xDomain).yDomain(yDomain);

  const volumeToPriceScale = d3
    .scaleLinear()
    .domain(volumeDomain)
    .range(yDomain);
  volumeSeries.mainValue(d => volumeToPriceScale(d.volume));

  areaSeries.baseValue(d => yDomain[0]);

  // select and render
  d3.select("#chart-element")
    .datum(mergedData)
    .call(chart);
});
