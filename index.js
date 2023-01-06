async function getData(url) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
        redirect: 'follow',
    });
    return response.json();
}

async function loadCountriesData() {
    const countries = await getData('https://restcountries.com/v3.1/all?fields=name&fields=cca3');
    const arrCCA3toName = {};
    const arrNametoCCA3 = {};
    for (let i = 0; i < countries.length; i++) {
        const el = countries[i];
        arrCCA3toName[el.cca3] = el;
        arrNametoCCA3[el.name.common] = el.cca3;
    }
    return [arrCCA3toName, arrNametoCCA3];
}

const form = document.getElementById('form');
const fromCountry = document.getElementById('fromCountry');
const toCountry = document.getElementById('toCountry');
const countriesList = document.getElementById('countriesList');
const submit = document.getElementById('submit');
const output = document.getElementById('output');

async function loadBordersCountryData(country) {
    const countries = await getData(`https://restcountries.com/v3.1/alpha/${country}?fields=cca3&fields=borders`);
    return countries.borders.reduce((result, neighbor) => {
        result.push(neighbor);
        return result;
    }, []);
}

// path optimization
function minimazePath(maxLength, allPath, uniqueElement) {
    const resObject = {};
    for (let i = 0; i < uniqueElement.length; i++) {
        const currentCountry = uniqueElement[i];
        let minValue = maxLength;
        resObject[currentCountry] = { ph: [], dp: maxLength };
        for (let j = 0; j < allPath.length; j++) {
            const arr = allPath[j].split('>');
            const index = arr.indexOf(currentCountry);
            if (index >= 0 && index < minValue) {
                minValue = index + 1;
                if (minValue < resObject[currentCountry].dp) {
                    resObject[currentCountry].ph = [];
                    resObject[currentCountry].dp = minValue;
                }
                const element = arr.slice(0, minValue).join('>');
                if (resObject[currentCountry].ph.includes(element) === false) {
                    resObject[currentCountry].ph.push(element);
                }
            }
        }
    }
    return resObject;
}

async function getAllPathCountry(fromCountry, countryNeighborCach, maxDeep) {
    let countRequest = 0;
    const uniqueElement = [];
    // Find all possible paths from the given country
    async function buildPath(fromCountry, deep) {
        if (deep >= maxDeep) {
            return [fromCountry];
        }
        let arrNeighbor;
        // Let's see where to get information about the country server or cache
        let flagCach = false;
        if (countryNeighborCach.hasOwnProperty(fromCountry) === true) {
            arrNeighbor = countryNeighborCach[fromCountry];
            flagCach = true;
        } else {
            arrNeighbor = await loadBordersCountryData(fromCountry);
            countRequest += 1;
            countryNeighborCach[fromCountry] = [];
        }
        if (flagCach === false) {
            const index = arrNeighbor.indexOf(fromCountry);
            if (index > -1) {
                arrNeighbor.splice(index, 1);
            }
            countryNeighborCach[fromCountry] = arrNeighbor.concat([]);
        }
        const resultArray = [];
        for (let i = 0; i < arrNeighbor.length; i++) {
            resultArray.push(buildPath(arrNeighbor[i], deep + 1));
            if (uniqueElement.includes(arrNeighbor[i]) === false) {
                uniqueElement.push(arrNeighbor[i]);
            }
        }
        return Promise.all(resultArray).then((result) => {
            const resPath = [];
            for (let i = 0; i < result.length; i++) {
                for (let j = 0; j < result[i].length; j++) {
                    resPath.push(`${fromCountry}>${result[i][j]}`);
                }
            }
            return resPath;
        });
    }
    const allPath = await buildPath(fromCountry, 1);
    const minPath = minimazePath(maxDeep, allPath, uniqueElement);
    return [minPath, countRequest];
}
// got two lists of paths.
// The first list is all paths from the starting point.
// The second list is all paths from the endpoint.
// We combine two lists and find the final result

function findShortWay(fromCountry, toCountry, maxDeep) {
    const keyFrom = Object.keys(fromCountry);
    const keyTo = Object.keys(toCountry);
    let keyMinArr = [];
    for (let i = 0; i < keyFrom.length; i++) {
        for (let j = 0; j < keyTo.length; j++) {
            if (keyFrom[i] === keyTo[j]) {
                const ln = fromCountry[keyFrom[i]].dp + toCountry[keyTo[j]].dp;
                if (maxDeep === ln) {
                    keyMinArr.push(keyFrom[i]);
                } else if (maxDeep < ln) {
                    keyMinArr = [];
                    maxDeep = ln;
                }
            }
        }
    }
    const resArray = [];
    for (let i = 0; i < keyMinArr.length; i++) {
        const key = keyMinArr[i];
        for (let ii = 0; ii < toCountry[key].ph.length; ii++) {
            const second = toCountry[key].ph[ii].split('>').reverse().slice(1).join('>');
            for (let jj = 0; jj < fromCountry[key].ph.length; jj++) {
                const first = fromCountry[key].ph[jj];
                resArray.push(`${first}>${second}`);
            }
        }
    }
    return resArray;
}
function convertPathFromCodeToName(path, converter) {
    const pathName = [];
    for (let i = 0; i < path.length; i++) {
        const arr = path[i]
            .split('>')
            .map((x) => converter[x].name.common)
            .join('=>');
        pathName.push(arr);
    }
    return pathName;
}
async function startFindShortPath(fromCountry, toCountry, arrCountry) {
    const maxDeepHalf = 5;
    const countryNeighborCach = [];
    const [resultPathfromCountry, cntRequestfromCountry] = await getAllPathCountry(
        fromCountry,
        countryNeighborCach,
        maxDeepHalf
    );
    if (resultPathfromCountry.hasOwnProperty(toCountry) === true) {
        const shortPathsName = convertPathFromCodeToName(resultPathfromCountry[toCountry].ph, arrCountry);
        return [shortPathsName, cntRequestfromCountry];
    }
    const [resultPathftoCountry, cntRequesttoCountry] = await getAllPathCountry(
        toCountry,
        countryNeighborCach,
        maxDeepHalf
    );
    const shortPaths = findShortWay(resultPathfromCountry, resultPathftoCountry, maxDeepHalf * 2);
    const shortPathsName = convertPathFromCodeToName(shortPaths, arrCountry);
    return [shortPathsName, cntRequestfromCountry + cntRequesttoCountry];
}

(async () => {
    function setStatusElement(flag) {
        fromCountry.disabled = flag;
        toCountry.disabled = flag;
        submit.disabled = flag;
    }
    setStatusElement(true);
    output.innerHTML = 'Loading…';
    let [countriesData, arrNametoCCA3] = [[], []];
    try {
        [countriesData, arrNametoCCA3] = await loadCountriesData();
    } catch {
        output.innerHTML = `<p style="color:red">It seems that you do not have an internet connection or the server is not available</p>`;
        setStatusElement(false);
        return;
    }
    output.innerHTML = '';
    Object.keys(countriesData)
        .sort((a, b) => countriesData[b].area - countriesData[a].area)
        .forEach((code) => {
            const option = document.createElement('option');
            option.value = countriesData[code].name.common;
            countriesList.appendChild(option);
        });

    setStatusElement(false);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        async function start() {
            if (
                arrNametoCCA3.hasOwnProperty(fromCountry.value) === true &&
                arrNametoCCA3.hasOwnProperty(toCountry.value) === true
            ) {
                if (fromCountry.value === toCountry.value) {
                    output.innerHTML = `<ol><li>${arrNametoCCA3[toCountry.value]}</li></ol><br>`;
                    output.innerHTML += `<h4>It took 0 requests for server</h4>`;
                } else {
                    setStatusElement(true);
                    output.innerHTML = 'Loading…';
                    let [path, cnt] = [[], 0];
                    try {
                        [path, cnt] = await startFindShortPath(
                            arrNametoCCA3[fromCountry.value],
                            arrNametoCCA3[toCountry.value],
                            countriesData
                        );
                    } catch {
                        output.innerHTML = `<p style="color:red">It seems that you do not have an internet connection or the server is not available</p>`;
                        setStatusElement(false);
                        return;
                    }
                    if (path.length > 0) {
                        output.innerHTML = '<ol>';
                        for (let i = 0; i < path.length; i++) {
                            output.innerHTML += `<li>${path[i]}</li>`;
                        }
                        output.innerHTML += '</ol><br>';
                    } else {
                        output.innerHTML = '<h5>Unfortunately the path was not found.</h5><br>';
                    }
                    output.innerHTML += `<h4>It took ${cnt} requests for server</h4>`;
                    setStatusElement(false);
                }
            } else {
                output.innerHTML = `<h4>Some countries do not yet exist on our list(${fromCountry.value} or ${toCountry.value})</h4>`;
            }
        }
        start();
        // TODO: Вывести, откуда и куда едем, и что идёт расчёт.
        // TODO: Рассчитать маршрут из одной страны в другую за минимум запросов.
        // TODO: Вывести маршрут и общее количество запросов.
    });
})();
