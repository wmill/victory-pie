import { assign, defaults, isFunction, omit } from "lodash";
import d3Shape from "d3-shape";

import { Helpers, Events, Style } from "victory-core";

export default {
  checkForValidText(text) {
    if (text === undefined || text === null) {
      return text;
    } else {
      return `${text}`;
    }
  },

  getSliceStyle(datum, index, calculatedValues) {
    const { style, colors } = calculatedValues;
    const fill = this.getColor(style, colors, index);
    const dataStyles = omit(datum, ["x", "y", "label"]);
    const sliceStyle = defaults({}, {fill}, style.data, dataStyles);
    return Helpers.evaluateStyle(sliceStyle, datum);
  },

  getBaseProps(props, fallbackProps) {
    props = Helpers.modifyProps(props, fallbackProps, "pie");
    const calculatedValues = this.getCalculatedValues(props);
    const { slices, style, pathFunction } = calculatedValues;
    const childProps = { parent: {
      slices, pathFunction, width: props.width, height: props.height, style: style.parent}
    };
    for (let index = 0, len = slices.length; index < len; index++) {
      const slice = slices[index];
      const datum = slice.data;
      const eventKey = datum.eventKey || index;
      const dataProps = {
        index,
        slice,
        pathFunction,
        style: this.getSliceStyle(datum, index, calculatedValues),
        datum
      };

      childProps[eventKey] = {
        data: dataProps,
        labels: this.getLabelProps(props, dataProps, calculatedValues)
      };
    }
    return childProps;
  },

  getLabelProps(props, dataProps, calculatedValues) {
    const { index, datum, slice } = dataProps;
    const { style, radius } = calculatedValues;
    const labelStyle = Helpers.evaluateStyle(assign({padding: 0}, style.labels), datum);
    const labelRadius = Helpers.evaluateProp(props.labelRadius, datum);
    const labelPosition = this.getLabelPosition(radius, labelRadius, labelStyle);
    const position = labelPosition.centroid(slice);
    const orientation = this.getLabelOrientation(slice);
    return {
      index, datum, slice, orientation,
      style: labelStyle,
      x: position[0],
      y: position[1],
      text: this.getLabelText(props, datum, index),
      textAnchor: labelStyle.textAnchor || this.getTextAnchor(orientation),
      verticalAnchor: labelStyle.verticalAnchor || this.getVerticalAnchor(orientation),
      angle: labelStyle.angle
    };
  },

  getCalculatedValues(props) {
    const { theme, colorScale } = props;
    const styleObject = theme && theme.pie && theme.pie.style ? theme.pie.style : {};
    const style = Helpers.getStyles(props.style, styleObject, "auto", "100%");
    const colors = Array.isArray(colorScale) ? colorScale : Style.getColorScale(colorScale);
    const padding = Helpers.getPadding(props);
    const radius = this.getRadius(props, padding);
    const data = Events.addEventKeys(props, Helpers.getData(props));
    const layoutFunction = this.getSliceFunction(props);
    const slices = layoutFunction(data);
    const pathFunction = d3Shape.arc()
      .cornerRadius(props.cornerRadius)
      .outerRadius(radius)
      .innerRadius(props.innerRadius);
    return {style, colors, padding, radius, data, slices, pathFunction};
  },

  getColor(style, colors, index) {
    if (style && style.data && style.data.fill) {
      return style.data.fill;
    }
    return colors[index % colors.length];
  },

  getRadius(props, padding) {
    return Math.min(
      props.width - padding.left - padding.right,
      props.height - padding.top - padding.bottom
    ) / 2;
  },

  getLabelPosition(radius, labelRadius, style) {
    // TODO: better label positioning
    const padding = style && style.padding || 0;
    const arcRadius = labelRadius || radius + padding;
    return d3Shape.arc()
      .outerRadius(arcRadius)
      .innerRadius(arcRadius);
  },

  getLabelOrientation(slice) {
    const radiansToDegrees = (radians) => {
      return radians * (180 / Math.PI);
    };
    const start = radiansToDegrees(slice.startAngle);
    const end = radiansToDegrees(slice.endAngle);
    const degree = start + (end - start) / 2;
    if (degree < 45 || degree > 315) {
      return "top";
    } else if (degree >= 45 && degree < 135) {
      return "right";
    } else if (degree >= 135 && degree < 225) {
      return "bottom";
    } else {
      return "left";
    }
  },

  getTextAnchor(orientation) {
    if (orientation === "top" || orientation === "bottom") {
      return "middle";
    }
    return orientation === "right" ? "start" : "end";
  },

  getVerticalAnchor(orientation) {
    if (orientation === "left" || orientation === "right") {
      return "middle";
    }
    return orientation === "bottom" ? "start" : "end";
  },

  getLabelText(props, datum, index) {
    let text;
    if (datum.label) {
      text = datum.label;
    } else if (Array.isArray(props.labels)) {
      text = props.labels[index];
    } else {
      text = isFunction(props.labels) ? props.labels(datum) : datum.xName || datum.x;
    }
    return this.checkForValidText(text);
  },

  getSliceFunction(props) {
    const degreesToRadians = (degrees) => {
      return degrees * (Math.PI / 180);
    };

    return d3Shape.pie()
      .sort(null)
      .startAngle(degreesToRadians(props.startAngle))
      .endAngle(degreesToRadians(props.endAngle))
      .padAngle(degreesToRadians(props.padAngle))
      .value((datum) => { return datum.y; });
  }
};
