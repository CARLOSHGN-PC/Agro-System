const onEachFeature = (feature, layer) => {
  if (feature.properties) {
    const { COD, FUNDO_AGR, FAZENDA, CATEGORIA, TALHAO, AREA, VARIEDADE, ECORTE, PROP } = feature.properties;
    let popupContent = `<div class="p-2 space-y-1">
      <div class="font-bold border-b pb-1 mb-2">Talhão Info</div>`;

    const addProp = (label, value) => {
      if (value !== undefined && value !== null) {
        popupContent += `<div class="flex justify-between gap-4"><span class="font-semibold">${label}:</span> <span>${value}</span></div>`;
      }
    };

    addProp('COD', COD);
    addProp('FUNDO_AGR', FUNDO_AGR);
    addProp('FAZENDA', FAZENDA);
    addProp('CATEGORIA', CATEGORIA);
    addProp('TALHAO', TALHAO);
    addProp('AREA', AREA);
    addProp('VARIEDADE', VARIEDADE);
    addProp('ECORTE', ECORTE);
    addProp('PROP', PROP);

    popupContent += `</div>`;
    layer.bindPopup(popupContent);
  }
};
console.log(onEachFeature.toString());
