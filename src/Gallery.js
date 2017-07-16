import React, { Component } from 'react';
import Textfit from 'react-textfit';
import Masonry from 'react-masonry-component';
import './Gallery.css';

const masonryOptions = {
  isFitWidth: true
};


class Gallery extends Component {
  render() {
    var childElements = this.props.elements.map((element, id) => {
      const classes = `PolaroidWrapper ${element.style}`;
      return (
        <div
          key={id}
          className={classes}
        >
          <div className="Polaroid">
            <div className="ImageWrapper">
              <a
                href={element.src}
                data-lightbox={id}
                data-title={element.title}
              >
                <img alt="" src={element.src} />
              </a>
            </div>
            <Textfit mode="single" className="Text">
              {element.title}
            </Textfit>
          </div>
        </div>
      );
    });

    const classes = `Gallery ${this.props.theme}`;
    return (
      <Masonry
        className={classes}
        disableImagesLoaded={false} // default false
        updateOnEachImageLoad={false} // default false and works only if disableImagesLoaded is false
        options={masonryOptions}
      >
        {childElements}
      </Masonry>
    );
  }
}

export default Gallery;
